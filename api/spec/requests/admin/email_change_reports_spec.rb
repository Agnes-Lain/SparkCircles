require "rails_helper"

RSpec.describe "Back office \"This wasn't me\" reports (design section 8)", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:member) { create(:user, email: "attacker@example.com", security_locked_at: Time.current) }
  let!(:report) do
    create(:email_change, user: member, previous_email: "claire.m@example.com", new_email: "attacker@example.com",
                          changed_at: 2.days.ago, reported_at: 30.hours.ago)
  end

  before { admin_log_in(admin) }

  it "W4 lists open reports first, oldest first, with the waiting time and a Review link" do
    get "/admin/members"

    body = response.body
    expect(body.index("This wasn't me")).to be < body.index("Find a member")
    expect(body).to include("1 open", "These accounts are locked until you act", "30 h", "Over 24 h", "Review")
    expect(body).to include('<span class="visually-hidden">1 open report</span>')
  end

  it "W5 shows the open report first with the Locked badge" do
    get "/admin/members/#{member.id}", params: { reason: "email_change_report" }

    expect(response.body).to include("Locked", "claire.m@…", "attacker@…", "Restore previous email", "Close without restoring")
    expect(response.body).to include('<dialog class="modal" id="restore-dialog"')
  end

  describe "AC-13.8 restore" do
    it "BUG-02 restores the email, ends every session, invalidates the password and sends a reset link" do
      device = auth_headers(member)

      expect do
        post "/admin/members/#{member.id}/restore_email", params: { email_change_id: report.id }
      end.to have_enqueued_job(AccountTokenEmailJob).with(member, "reset_password_instructions")
      expect(flash[:notice]).to eq("Email restored. A password reset link was sent to claire.m@…")

      expect(member.reload).to have_attributes(email: "claire.m@example.com", security_locked_at: nil)
      expect(member.valid_password?(strong_test_password)).to be(false)
      get "/api/v1/me", headers: device
      expect(response).to have_http_status(:unauthorized)
      post "/api/v1/sessions", params: { email: "claire.m@example.com", password: strong_test_password }, as: :json
      expect(response).to have_http_status(:unauthorized)

      perform_enqueued_jobs(only: AccountTokenEmailJob)
      expect(ActionMailer::Base.deliveries.last.to).to eq([ "claire.m@example.com" ])

      get "/admin/members/#{member.id}", params: { reason: "email_change_report" }
      expect(response.body).to include("Restored ✓", "Reset link sent to claire.m@…")
    end

    it "shows the design error when the previous email is now used by another account" do
      create(:user, email: "claire.m@example.com")

      post "/admin/members/#{member.id}/restore_email", params: { email_change_id: report.id }
      follow_redirect!

      expect(response.body).to include("This email can't be restored", "Another account uses it now")
      expect(member.reload.email).to eq("attacker@example.com")
    end
  end

  it "R2-01 AC-13.10 shows no action on a report about the admin's own account, only an explanation" do
    create(:email_change, user: admin, reported_at: 1.hour.ago)

    get "/admin/members/#{admin.id}", params: { reason: "email_change_report" }

    expect(response.body).to include("This report is about your own account. Another admin handles it.")
    expect(response.body).not_to include("Restore previous email", "Close without restoring", 'data-dialog-open="restore-dialog"')
  end

  it "R2-02 reads the nav count with the right plural in both locales" do
    create(:email_change, user: create(:user), reported_at: 2.hours.ago)

    get "/admin/members"
    expect(response.body).to include('<span class="visually-hidden">2 open reports</span>')
    expect(I18n.t("admin.nav.open_reports", count: 1, locale: :en)).to eq("1 open report")
    expect(I18n.t("admin.nav.open_reports", count: 2, locale: :fr)).to eq("2 signalements ouverts")
    expect(I18n.t("admin.nav.open_reports", count: 1, locale: :fr)).to eq("1 signalement ouvert")
  end

  describe "AC-13.10 close without restoring" do
    it "requires a reason" do
      post "/admin/members/#{member.id}/close_report", params: { email_change_id: report.id, note: " " }
      follow_redirect!

      expect(response.body).to include("Write why you&#39;re closing the report")
      expect(report.reload.closed_at).to be_nil
    end

    it "keeps the new email, unlocks, invalidates the password, sends a reset link and records the reason" do
      expect do
        post "/admin/members/#{member.id}/close_report", params: { email_change_id: report.id, note: "Member confirmed by phone" }
      end.to have_enqueued_job(AccountTokenEmailJob).with(member, "report_closed")

      expect(member.reload).to have_attributes(email: "attacker@example.com", security_locked_at: nil)
      expect(member.valid_password?(strong_test_password)).to be(false)
      expect(report.reload).to have_attributes(closed_by_id: admin.id)
      event = AuditEvent.last
      expect(event).to have_attributes(action: "closed_email_change_report", reason: "email_change_report",
                                       note: "Member confirmed by phone", actor_id: admin.id)
      raw = AuditEvent.connection.select_value("SELECT note FROM audit_events WHERE id = #{AuditEvent.connection.quote(event.id)}")
      expect(raw).not_to include("Member confirmed")

      perform_enqueued_jobs(only: AccountTokenEmailJob)
      mail = ActionMailer::Base.deliveries.last
      expect(mail.to).to eq([ "attacker@example.com" ])
      expect(mail.text_part.body.to_s).to include("reset-password?token=")
    end

    it "AC-13.10 shows the closing reason to admins only, as an audited read, never to the member" do
      post "/admin/members/#{member.id}/close_report", params: { email_change_id: report.id, note: "Checked by phone\nwith the member" }

      expect do
        get "/admin/members/#{member.id}", params: { reason: "email_change_report" }
      end.to change(AuditEvent, :count).by(1)
      expect(response.body).to include("Closed without restoring", "<dt>Reason</dt>", "Checked by phone\n<br />with the member", "by #{admin.display_name} The email stayed")
      expect(AuditEvent.last.fields).to include("report_close_reasons")

      member.update!(password: new_test_password) # the member set a new password
      headers = auth_headers(member)
      member_responses = [ "/api/v1/me", "/api/v1/verification", "/api/v1/users/#{member.id}", "/api/v1/me/public_profile" ].map do |path|
        get path, headers: headers
        response.body
      end
      post "/api/v1/data_export", headers: headers
      perform_enqueued_jobs(only: BuildDataExportJob)
      get "/api/v1/data_export/download", headers: headers
      member_responses << response.body
      perform_enqueued_jobs
      member_responses += ActionMailer::Base.deliveries.select { |mail| mail.to == [ member.email ] }.map { |mail| mail.body.encoded }

      expect(member_responses.join).not_to include("Checked by phone")
    end

    it "refuses an admin closing a report on their own account" do
      own = create(:email_change, user: admin, reported_at: 1.hour.ago)

      post "/admin/members/#{admin.id}/close_report", params: { email_change_id: own.id, note: "Mine" }
      expect(response).to have_http_status(:forbidden)
      expect(own.reload.closed_at).to be_nil
    end
  end
end
