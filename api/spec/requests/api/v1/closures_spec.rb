require "rails_helper"

RSpec.describe "Account closure", type: :request do
  let(:user) { create(:user, marketing_opt_in: true) }
  let(:headers) { auth_headers(user) }

  describe "POST /api/v1/closure" do
    it "AC-11.1 requires the password" do
      post "/api/v1/closure", params: { current_password: "wrong-password-1" }, headers: headers, as: :json

      expect(error_code).to eq("invalid_password")
      expect(user.reload).not_to be_closed
    end

    it "AC-11.2 logs out every device, hides the profile, stops marketing and confirms by email" do
      other_device = auth_headers(user, device_name: "tablet")

      freeze_time do
        expect do
          post "/api/v1/closure", params: { current_password: "correct-horse-battery" }, headers: headers, as: :json
        end.to have_enqueued_mail(AccountMailer, :closure_confirmation)

        expect(response).to have_http_status(:accepted)
        expect(json.dig("closure", "erasure_on")).to eq(30.days.from_now.to_date.iso8601)
      end

      expect(user.reload).to be_closed
      expect(user.marketing_opt_in).to be(false)
      [ headers, other_device ].each do |device|
        get "/api/v1/me", headers: device
        expect(response).to have_http_status(:unauthorized)
      end
      get "/api/v1/users/#{user.id}", headers: auth_headers(create(:user))
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/v1/closure" do
    it "AC-11.3 lets the person cancel within 30 days after logging in, restoring the account" do
      user.update!(closed_at: 10.days.ago)
      post "/api/v1/sessions", params: { email: user.email, password: "correct-horse-battery" }, as: :json
      token_headers = { "Authorization" => "Bearer #{json['token']}" }
      expect(json.dig("user", "closure", "erasure_on")).to eq((user.closed_at + 30.days).to_date.iso8601)

      get "/api/v1/verification", headers: token_headers
      expect(error_code).to eq("closure_pending")

      delete "/api/v1/closure", headers: token_headers
      expect(response).to have_http_status(:ok)
      expect(json["closure"]).to be_nil
      expect(user.reload).not_to be_closed
    end

    it "returns 404 when no closure is pending" do
      delete "/api/v1/closure", headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end
end
