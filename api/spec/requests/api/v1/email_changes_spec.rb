require "rails_helper"

RSpec.describe "Email change", type: :request do
  let(:user) { create(:user, email: "claire@example.com") }
  let(:headers) { auth_headers(user) }

  def request_change(email, password: strong_test_password, with: headers)
    token = nil
    allow(AccountMailer).to receive(:confirmation_instructions).and_wrap_original do |original, record, raw, *rest|
      token = raw
      original.call(record, raw, *rest)
    end
    post "/api/v1/me/email_change", params: { email: email, current_password: password }, headers: with, as: :json
    perform_enqueued_jobs(only: AccountTokenEmailJob)
    token
  end

  def confirm(token, with: {})
    post "/api/v1/email_confirmations", params: { token: token }, headers: with, as: :json
  end

  it "AC-13.1 changes nothing and sends nothing with a wrong password" do
    expect { request_change("new@example.com", password: wrong_test_password) }
      .to not_change(ActionMailer::Base.deliveries, :count).and not_have_enqueued_mail

    expect(error_code).to eq("invalid_password")
    expect(user.reload.unconfirmed_email).to be_nil
  end

  it "AC-13.2 sends a link to the new address and keeps the old email for login" do
    request_change("new@example.com")
    expect(ActionMailer::Base.deliveries.last.to).to eq([ "new@example.com" ])

    expect(response).to have_http_status(:accepted)
    expect(json).to eq("status" => "check_new_inbox")
    expect(user.reload.email).to eq("claire@example.com")
    expect(user.unconfirmed_email).to eq("new@example.com")
  end

  it "AC-13.3 switches to the new address within 24 hours and confirms it there" do
    token = request_change("new@example.com")

    expect { travel(23.hours) { confirm(token, with: headers) } }
      .to have_enqueued_mail(AccountMailer, :email_changed)
      .and have_enqueued_mail(AccountMailer, :email_changed_notice)

    expect(response).to have_http_status(:ok)
    expect(user.reload.email).to eq("new@example.com")
  end

  it "AC-13.3 refuses an expired or used link" do
    token = request_change("new@example.com")
    travel(25.hours) { confirm(token) }
    expect(error_code).to eq("invalid_or_expired_token")
    expect(user.reload.email).to eq("claire@example.com")
  end

  it "AC-13.4 only the latest link works" do
    first = request_change("first@example.com")
    second = request_change("second@example.com")

    confirm(first)
    expect(error_code).to eq("invalid_or_expired_token")

    confirm(second)
    expect(user.reload.email).to eq("second@example.com")
  end

  it "AC-13.5 answers the same for an address used by another account and warns its owner" do
    owner = create(:user, email: "taken@example.com")

    expect { request_change("taken@example.com") }.to have_enqueued_mail(AccountMailer, :email_change_attempt).with(owner)

    expect(response).to have_http_status(:accepted)
    expect(json).to eq("status" => "check_new_inbox")
    expect(user.reload.unconfirmed_email).to be_nil
  end

  it "AC-13.6 refuses the change when the address was taken in the meantime" do
    token = request_change("new@example.com")
    create(:user, email: "new@example.com")

    confirm(token)

    expect(response).to have_http_status(:conflict)
    expect(error_code).to eq("email_taken")
    expect(user.reload.email).to eq("claire@example.com")
  end

  it "AC-13.9 logs out every other device and keeps the verification status" do
    user.update!(verification_status: "verified", verification_expires_on: 1.year.from_now.to_date)
    other = auth_headers(user, device_name: "tablet")
    token = request_change("new@example.com")

    confirm(token, with: headers)

    get "/api/v1/me", headers: headers
    expect(response).to have_http_status(:ok)
    expect(json.dig("verification", "status")).to eq("verified")
    get "/api/v1/me", headers: other
    expect(response).to have_http_status(:unauthorized)
  end

  it "refuses the current address and invalid formats" do
    request_change("claire@example.com")
    expect(json.dig("error", "details", "email")).to eq([ "same_as_current" ])

    request_change("nope")
    expect(json.dig("error", "details", "email")).to eq([ "invalid" ])
  end

  describe "AC-13.7 AC-13.8 This wasn't me" do
    let(:email_change) { create(:email_change, user: user) }

    it "secures the account at once from the link, without login" do
      device = auth_headers(user)
      token = email_change.generate_token_for(:report)

      expect do
        post "/api/v1/email_change_reports", params: { token: token }, as: :json
      end.to change(AuditEvent, :count).by(1)

      expect(response).to have_http_status(:accepted)
      expect(user.reload).to be_security_locked
      expect(email_change.reload).to be_reported
      expect(AuditEvent.last).to have_attributes(action: "email_change_reported", subject_user_id: user.id)
      get "/api/v1/me", headers: device
      expect(response).to have_http_status(:unauthorized)
    end

    it "works for 30 days only" do
      token = email_change.generate_token_for(:report)

      travel 31.days do
        post "/api/v1/email_change_reports", params: { token: token }, as: :json
      end
      expect(error_code).to eq("invalid_or_expired_token")
    end
  end
end
