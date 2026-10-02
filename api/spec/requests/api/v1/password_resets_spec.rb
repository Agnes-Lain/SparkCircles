require "rails_helper"

RSpec.describe "Password reset", type: :request do
  let!(:user) { create(:user, email: "claire@example.com") }

  def reset_token
    token = nil
    allow(AccountMailer).to receive(:reset_password_instructions).and_wrap_original do |original, record, raw, *rest|
      token = raw
      original.call(record, raw, *rest)
    end
    post "/api/v1/password_resets", params: { email: "claire@example.com" }, as: :json
    perform_enqueued_jobs(only: DeviseNotificationJob)
    token
  end

  describe "POST /api/v1/password_resets" do
    it "AC-4.1 always shows the same message and emails only existing accounts" do
      expect do
        post "/api/v1/password_resets", params: { email: "claire@example.com" }, as: :json
      end.to have_enqueued_job(DeviseNotificationJob).with(anything, "reset_password_instructions")
      known = [ response.status, json ]

      expect do
        post "/api/v1/password_resets", params: { email: "nobody@example.com" }, as: :json
      end.not_to have_enqueued_job(DeviseNotificationJob).with(anything, "reset_password_instructions")
      expect([ response.status, json ]).to eq(known)
      expect(response).to have_http_status(:accepted)
    end
  end

  describe "PUT /api/v1/password_resets" do
    it "AC-4.2 changes the password within 1 hour, logs out other devices and confirms by email" do
      other_device = auth_headers(user)
      token = reset_token

      expect do
        travel 50.minutes do
          put "/api/v1/password_resets", params: { token: token, password: "a-brand-new-secret" }, as: :json
        end
      end.to have_enqueued_mail(AccountMailer, :password_changed)

      expect(response).to have_http_status(:ok)
      expect(json["token"]).to be_present
      expect(user.reload.valid_password?("a-brand-new-secret")).to be(true)
      get "/api/v1/me", headers: other_device
      expect(response).to have_http_status(:unauthorized)
    end

    it "AC-4.3 refuses an expired link" do
      token = reset_token
      travel 61.minutes do
        put "/api/v1/password_resets", params: { token: token, password: "a-brand-new-secret" }, as: :json
      end

      expect(error_code).to eq("invalid_or_expired_token")
      expect(user.reload.valid_password?("correct-horse-battery")).to be(true)
    end

    it "AC-4.3 refuses a link that was already used" do
      token = reset_token
      put "/api/v1/password_resets", params: { token: token, password: "a-brand-new-secret" }, as: :json
      put "/api/v1/password_resets", params: { token: token, password: "another-new-secret" }, as: :json

      expect(error_code).to eq("invalid_or_expired_token")
    end

    it "AC-1.4 applies the password rules" do
      put "/api/v1/password_resets", params: { token: reset_token, password: "short" }, as: :json

      expect(json.dig("error", "details", "password")).to eq([ "too_short" ])
    end
  end

  describe "PUT /api/v1/me/password" do
    it "AC-4.4 requires the current password and logs out the other devices" do
      headers = auth_headers(user, device_name: "phone")
      other = auth_headers(user, device_name: "tablet")

      put "/api/v1/me/password", params: { current_password: "wrong-password-1", password: "a-brand-new-secret" },
                                 headers: headers, as: :json
      expect(error_code).to eq("invalid_password")

      put "/api/v1/me/password", params: { current_password: "correct-horse-battery", password: "a-brand-new-secret" },
                                 headers: headers, as: :json
      expect(response).to have_http_status(:ok)

      get "/api/v1/me", headers: headers
      expect(response).to have_http_status(:ok)
      get "/api/v1/me", headers: other
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
