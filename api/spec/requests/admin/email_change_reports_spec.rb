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
    expect(body).to include('aria-label="1 open report"')
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
      expect(member.valid_password?("correct-horse-battery")).to be(false)
      get "/api/v1/me", headers: device
      expect(response).to have_http_status(:unauthorized)
      post "/api/v1/sessions", params: { email: "claire.m@example.com", password: "correct-horse-battery" }, as: :json
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
      expect(member.valid_password?("correct-horse-battery")).to be(false)
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

    it "refuses an admin closing a report on their own account" do
      own = create(:email_change, user: admin, reported_at: 1.hour.ago)

      post "/admin/members/#{admin.id}/close_report", params: { email_change_id: own.id, note: "Mine" }
      expect(response).to have_http_status(:forbidden)
      expect(own.reload.closed_at).to be_nil
    end
  end
end
