require "rails_helper"

RSpec.describe "Email confirmation", type: :request do
  def confirmation_token_for(user)
    token = nil
    allow(AccountMailer).to receive(:confirmation_instructions).and_wrap_original do |original, record, raw_token, *rest|
      token = raw_token
      original.call(record, raw_token, *rest)
    end
    yield
    perform_enqueued_jobs(only: AccountTokenEmailJob)
    token
  end

  let(:user) { build(:user, :unconfirmed) }
  let!(:token) { confirmation_token_for(user) { user.save! } }

  describe "POST /api/v1/email_confirmations" do
    it "AC-2.1 confirms the email within 24 hours and logs the device in" do
      travel 23.hours do
        post "/api/v1/email_confirmations", params: { token: token }, as: :json
      end

      expect(response).to have_http_status(:ok)
      expect(json["token"]).to be_present
      expect(json.dig("user", "email_confirmed")).to be(true)
      expect(user.reload).to be_confirmed
    end

    it "AC-2.2 changes nothing for an expired link" do
      travel 25.hours do
        post "/api/v1/email_confirmations", params: { token: token }, as: :json
      end

      expect(response).to have_http_status(:unprocessable_content)
      expect(error_code).to eq("invalid_or_expired_token")
      expect(user.reload).not_to be_confirmed
    end

    it "AC-2.2 changes nothing for an already used link" do
      post "/api/v1/email_confirmations", params: { token: token }, as: :json
      post "/api/v1/email_confirmations", params: { token: token }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(error_code).to eq("invalid_or_expired_token")
    end
  end

  describe "POST /api/v1/email_confirmations/resend" do
    it "AC-2.2 sends a new link and answers the same for unknown emails" do
      expect do
        post "/api/v1/email_confirmations/resend", params: { email: user.email }, as: :json
      end.to have_enqueued_job(AccountTokenEmailJob).with(anything, "confirmation_instructions")
      expect(response).to have_http_status(:accepted)
      known = json

      post "/api/v1/email_confirmations/resend", params: { email: "nobody@example.com" }, as: :json
      expect(json).to eq(known)
    end

    it "AC-2.3 works for a logged-in unconfirmed account" do
      expect do
        post "/api/v1/email_confirmations/resend", headers: auth_headers(user), as: :json
      end.to have_enqueued_job(AccountTokenEmailJob).with(anything, "confirmation_instructions")
    end
  end

  describe "AC-2.3 unconfirmed accounts" do
    it "can only see their account and resend the link" do
      headers = auth_headers(user)

      get "/api/v1/me", headers: headers
      expect(response).to have_http_status(:ok)

      other = create(:user)
      get "/api/v1/users/#{other.id}", headers: headers
      expect(response).to have_http_status(:forbidden)
      expect(error_code).to eq("email_not_confirmed")

      patch "/api/v1/me", params: { user: { first_name: "X" } }, headers: headers, as: :json
      expect(error_code).to eq("email_not_confirmed")
    end
  end
end
