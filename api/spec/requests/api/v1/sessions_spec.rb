require "rails_helper"

RSpec.describe "Sessions", type: :request do
  let!(:user) { create(:user, email: "claire@example.com") }

  def log_in(email: "claire@example.com", password: strong_test_password)
    post "/api/v1/sessions", params: { email: email, password: password, device_name: "iPhone" }, as: :json
  end

  describe "POST /api/v1/sessions" do
    it "AC-3.1 logs a confirmed account in and returns a token and the account" do
      log_in

      expect(response).to have_http_status(:created)
      expect(json["token"]).to be_present
      expect(json.dig("user", "email")).to eq("claire@example.com")
      expect(user.allowlisted_jwts.count).to eq(1)
    end

    it "AC-3.2 gives the same answer for a wrong email and a wrong password" do
      log_in(password: wrong_test_password)
      wrong_password = [ response.status, json ]
      log_in(email: "nobody@example.com")

      expect([ response.status, json ]).to eq(wrong_password)
      expect(error_code).to eq("invalid_credentials")
      expect(response).to have_http_status(:unauthorized)
    end

    it "BUG-07 runs a password check for unknown emails too, so timing doesn't reveal accounts" do
      expect(Devise::Encryptor).to receive(:compare).once.and_call_original

      log_in(email: "nobody@example.com")
      expect(error_code).to eq("invalid_credentials")
    end

    it "AC-3.3 blocks the account for 15 minutes after 5 failures in 15 minutes and emails the owner" do
      expect { 5.times { log_in(password: wrong_test_password) } }
        .to have_enqueued_mail(AccountMailer, :account_locked).with(user)

      expect(response).to have_http_status(:locked)
      expect(error_code).to eq("account_locked")

      log_in
      expect(response).to have_http_status(:locked)

      travel 16.minutes do
        log_in
        expect(response).to have_http_status(:created)
      end
    end

    it "AC-3.3 does not count failures older than 15 minutes" do
      4.times { log_in(password: wrong_test_password) }

      travel 16.minutes do
        log_in(password: wrong_test_password)
        expect(error_code).to eq("invalid_credentials")
        expect(user.reload.failed_attempts).to eq(1)
      end
    end

    it "AC-2.3 lets an unconfirmed account log in, limited to the confirmation screen" do
      create(:user, :unconfirmed, email: "new@example.com")

      log_in(email: "new@example.com")
      expect(response).to have_http_status(:created)
      expect(json.dig("user", "email_confirmed")).to be(false)

      get "/api/v1/verification", headers: { "Authorization" => "Bearer #{json['token']}" }
      expect(response).to have_http_status(:forbidden)
      expect(error_code).to eq("email_not_confirmed")
    end

    it "AC-13.8 D-8 refuses login with account_secured while the account is locked by a report" do
      user.update!(security_locked_at: Time.current)

      log_in
      expect(response).to have_http_status(:locked)
      expect(error_code).to eq("account_secured")
      expect(json.dig("error", "message")).to eq(I18n.t("api.errors.account_secured"))
    end

    it "AC-13.8 D-8 answers account_secured even with a wrong password, without counting a failure" do
      user.update!(security_locked_at: Time.current)

      log_in(password: wrong_test_password)
      expect(error_code).to eq("account_secured")
      expect(user.reload.failed_attempts).to eq(0)
    end

    it "D-8 keeps account_locked for too many attempts, distinct from account_secured" do
      5.times { log_in(password: wrong_test_password) }

      expect(response).to have_http_status(:locked)
      expect(error_code).to eq("account_locked")
    end
  end

  describe "token lifetime" do
    it "AC-3.4 keeps a device logged in while it is used, and asks to log in after 30 days without use" do
      headers = auth_headers(user)

      travel 20.days do
        get "/api/v1/me", headers: headers
        expect(response).to have_http_status(:ok)
      end
      travel 45.days do
        get "/api/v1/me", headers: headers
        expect(response).to have_http_status(:ok)
      end
      travel 76.days do
        get "/api/v1/me", headers: headers
        expect(response).to have_http_status(:unauthorized)
        expect(error_code).to eq("unauthorized")
      end
    end

    it "refuses a request without a token or with a forged token" do
      get "/api/v1/me"
      expect(response).to have_http_status(:unauthorized)

      get "/api/v1/me", headers: { "Authorization" => "Bearer not-a-jwt" }
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "DELETE /api/v1/sessions/current" do
    it "AC-3.5 logs out this device only" do
      phone = auth_headers(user, device_name: "phone")
      tablet = auth_headers(user, device_name: "tablet")

      delete "/api/v1/sessions/current", headers: phone
      expect(response).to have_http_status(:no_content)

      get "/api/v1/me", headers: phone
      expect(response).to have_http_status(:unauthorized)
      get "/api/v1/me", headers: tablet
      expect(response).to have_http_status(:ok)
    end
  end

  describe "DELETE /api/v1/sessions" do
    it "AC-3.6 logs out every device, the current one included" do
      phone = auth_headers(user, device_name: "phone")
      tablet = auth_headers(user, device_name: "tablet")

      delete "/api/v1/sessions", headers: phone
      expect(response).to have_http_status(:no_content)

      [ phone, tablet ].each do |headers|
        get "/api/v1/me", headers: headers
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end

RSpec.describe "BUG-13 token renewal", type: :request do
  let(:user) { create(:user) }

  it "AC-3.4 renews the token while the device is used, so it never hits a hard expiry" do
    headers = auth_headers(user)

    travel 10.days do
      get "/api/v1/me", headers: headers
      expect(response.headers["Authorization"]).to be_nil
    end

    renewed = nil
    travel 40.days do
      get "/api/v1/me", headers: headers
      renewed = response.headers["Authorization"]
      expect(renewed).to start_with("Bearer ")
    end

    travel 65.days do
      get "/api/v1/me", headers: { "Authorization" => renewed }
      expect(response).to have_http_status(:ok)
    end
    travel 90.days do
      get "/api/v1/me", headers: { "Authorization" => renewed }
      expect(response).to have_http_status(:ok)
      get "/api/v1/me", headers: headers
      expect(response).to have_http_status(:unauthorized) # the first token reached its 60-day expiry
    end
  end

  it "AC-3.5 logging out a device also ends its renewed token" do
    headers = auth_headers(user)
    renewed = nil
    travel 40.days do
      get "/api/v1/me", headers: headers
      renewed = { "Authorization" => response.headers["Authorization"] }
      delete "/api/v1/sessions/current", headers: headers
      get "/api/v1/me", headers: renewed
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
