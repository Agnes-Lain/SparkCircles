require "rails_helper"

# QA round 3 (2026-10-03) for PR #2. See docs/qa/accounts-and-verification.md, round 3.
RSpec.describe "QA round 3: accounts and verification", type: :request do
  let(:password) { strong_test_password }
  let(:secret_reason) { "Checked by phone QA-REASON-7731" }
  let(:admin) { create(:user, :admin) }
  let(:member) { create(:user, email: "member.new@example.com", locale: "fr", security_locked_at: Time.current) }
  let!(:report) do
    create(:email_change, user: member, previous_email: "member.old@example.com", new_email: "member.new@example.com",
                          reported_at: 1.hour.ago)
  end

  def close_report_as_admin
    admin_log_in(admin)
    post "/admin/members/#{member.id}/close_report", params: { email_change_id: report.id, note: secret_reason }
    expect(report.reload.closed_at).to be_present
  end

  it "AC-13.10 shows the closing reason to admins only, in an audited view, stored encrypted" do
    close_report_as_admin

    raw = AuditEvent.connection.select_values("SELECT row_to_json(a)::text FROM audit_events a").join
    expect(raw).not_to include("QA-REASON-7731")

    expect { get "/admin/members/#{member.id}", params: { reason: "email_change_report" } }
      .to change(AuditEvent, :count).by(1)
    expect(response.body).to include("Closed without restoring", "QA-REASON-7731")
    expect(AuditEvent.last).to have_attributes(action: "viewed_member", actor_id: admin.id, subject_user_id: member.id)
    expect(AuditEvent.last.fields).to include("report_close_reasons")
  end

  it "AC-13.10 never sends the closing reason to the member: API, data copy or emails" do
    close_report_as_admin
    perform_enqueued_jobs

    member_mail = ActionMailer::Base.deliveries.select { |mail| mail.to.include?("member.new@example.com") }
    expect(member_mail).not_to be_empty
    expect(member_mail.map { |mail| mail.body.encoded }.join).not_to include("QA-REASON-7731")

    # The member logs in again after setting a new password (reset link).
    token = CGI.unescape(member_mail.last.text_part.body.to_s[/reset-password\?token=(\S+)/, 1])
    put "/api/v1/password_resets", params: { token: token, password: new_test_password }, as: :json
    expect(response).to have_http_status(:ok)
    headers = { "Authorization" => "Bearer #{json['token']}" }

    bodies = [ json.to_json ]
    %w[/api/v1/me /api/v1/verification /api/v1/me/public_profile].each do |path|
      get path, headers: headers
      bodies << response.body
    end
    post "/api/v1/data_export", headers: headers
    perform_enqueued_jobs
    get "/api/v1/data_export/download", headers: headers
    expect(response).to have_http_status(:ok)
    bodies << response.body

    expect(bodies.join).not_to include("QA-REASON-7731")
  end

  it "ends the resolved-card caption with one period after an admin's name (\"Claire M.\")" do
    close_report_as_admin
    get "/admin/members/#{member.id}", params: { reason: "email_change_report" }

    expect(response.body).to include("by #{admin.display_name} The email stayed")
    expect(response.body).not_to include("#{admin.display_name}..")
  end

  it "R2-01 shows an explanation and no action button on a report about the admin's own account" do
    own = create(:email_change, user: admin, previous_email: "a.old@example.com", new_email: admin.email,
                                reported_at: 1.hour.ago)
    admin_log_in(admin)
    get "/admin/members/#{admin.id}", params: { reason: "email_change_report" }

    expect(response.body).to include("This report is about your own account. Another admin handles it.")
    expect(response.body).not_to include('data-dialog-open="restore-dialog"', 'data-dialog-open="close-report-dialog"')
    expect(own.reload).to be_open_report
  end

  it "the English-only back office doesn't change the member's language (emails and API)" do
    close_report_as_admin
    perform_enqueued_jobs

    mail = ActionMailer::Base.deliveries.select { |m| m.to.include?("member.new@example.com") }.last
    expect(mail.subject).to eq(I18n.t("account_mailer.report_closed.subject", locale: :fr))

    get "/api/v1/me" # no token, no Accept-Language: French default, right after an admin request
    expect(json.dig("error", "message")).to eq(I18n.t("api.errors.unauthorized", locale: :fr))
    expect(I18n.locale).to eq(I18n.default_locale)
  end
end
