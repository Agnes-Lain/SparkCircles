require "rails_helper"

# QA re-test round (2026-10-03) for PR #2. See docs/qa/accounts-and-verification.md, round 2.
RSpec.describe "QA round 2: accounts and verification", type: :request do
  let(:password) { "correct-horse-battery" }

  describe "AC-1.4 breached-password list is wired up" do
    it "refuses SecLists entries (any case) and French starter entries at sign-up" do
      %w[Basketball 1q2w3e4r5t6y azerty1234].each do |common|
        post "/api/v1/registrations", params: { user: {
          first_name: "Eve", last_name: "Test", email: "eve-#{common}@example.com", password: common,
          adult_confirmed: true, terms_accepted: true
        } }, as: :json

        expect(response).to have_http_status(:unprocessable_content), common
        expect(json.dig("error", "details", "password")).to eq([ "too_common" ]), common
      end
    end
  end

  describe "AC-7.3 / EXIF stripping" do
    it "accepts an iPhone HEIC photo and stores it re-encoded as JPEG, encrypted" do
      parent = create(:user)
      heic = Rack::Test::UploadedFile.new(file_fixture("qa_photo.heic"), "image/heic")
      post "/api/v1/verification", params: {
        document_type: "passport", document_front: heic, selfie: upload, date_of_birth: "1990-01-01"
      }, headers: auth_headers(parent)

      expect(response).to have_http_status(:created)
      verification = parent.verifications.last
      stored = verification.read_encrypted(:document_front)
      expect(stored.b).to start_with("\xFF\xD8\xFF".b)
      expect(stored.b).not_to include("Exif".b)
      expect(verification.front_content_type).to eq("image/jpeg")
    end
  end

  describe "AC-10.6 BUG-03 other one-time tokens stay out of job arguments and logs" do
    def capture_job_logs
      io = StringIO.new
      loggers = [ ActiveJob::Base, ActionMailer::Base ]
      previous = loggers.map(&:logger)
      loggers.each { |klass| klass.logger = ActiveSupport::Logger.new(io).tap { |logger| logger.level = :info } }
      yield
      io.string
    ensure
      loggers.each_with_index { |klass, index| klass.logger = previous[index] }
    end

    it "keeps the sign-up confirmation token out of stored arguments and logs" do
      stored = nil
      logs = capture_job_logs do
        post "/api/v1/registrations", params: { user: {
          first_name: "Ana", last_name: "Test", email: "ana@example.com", password: "uncommon-pass-9182",
          adult_confirmed: true, terms_accepted: true
        } }, as: :json
        stored = enqueued_jobs.map { |job| job["arguments"] }.inspect
        perform_enqueued_jobs
      end

      token = User.find_by(email: "ana@example.com").confirmation_token
      expect(token).to be_present
      expect(ActionMailer::Base.deliveries.last.text_part.body.to_s).to include(token)
      expect(stored).not_to include(token)
      expect(logs).not_to include(token)
    end

    it "keeps the \"This wasn't me\" token out of stored arguments and logs" do
      user = create(:user, email: "old@example.com")
      headers = auth_headers(user)
      post "/api/v1/me/email_change", params: { email: "new@example.com", current_password: password },
                                      headers: headers, as: :json
      perform_enqueued_jobs
      confirmation = user.reload.confirmation_token
      ActionMailer::Base.deliveries.clear

      stored = nil
      logs = capture_job_logs do
        post "/api/v1/email_confirmations", params: { token: confirmation }, as: :json
        stored = enqueued_jobs.map { |job| job["arguments"] }.inspect
        perform_enqueued_jobs
      end

      notice = ActionMailer::Base.deliveries.find { |mail| mail.to == [ "old@example.com" ] }
      token = CGI.unescape(notice.text_part.body.to_s[/this-wasnt-me\?token=(\S+)/, 1])
      expect(EmailChange.find_by_token_for(:report, token)).to be_present
      expect(stored).not_to include(token)
      expect(logs).not_to include(token)
    end
  end

  describe "AC-3.4 AC-3.5 AC-3.6 renewed device tokens" do
    it "renews once when due, the renewed token works, and log out of all devices kills both" do
      user = create(:user)
      token = user.issue_token!(device_name: "phone")
      headers = { "Authorization" => "Bearer #{token}" }

      get "/api/v1/me", headers: headers
      expect(response.headers["Authorization"]).to be_nil # 60 days left: not due

      travel 20.days do
        get "/api/v1/me", headers: headers # used: still 40 days left, not due
        expect(response.headers["Authorization"]).to be_nil
      end

      travel 35.days do
        get "/api/v1/me", headers: headers
        renewed = response.headers["Authorization"]
        expect(renewed).to start_with("Bearer ")
        expect(renewed).not_to eq("Bearer #{token}")

        get "/api/v1/me", headers: headers
        expect(response.headers["Authorization"]).to be_nil # already renewed for this device

        get "/api/v1/me", headers: { "Authorization" => renewed }
        expect(response).to have_http_status(:ok)

        delete "/api/v1/sessions", headers: { "Authorization" => renewed }
        expect(response).to have_http_status(:no_content)
        get "/api/v1/me", headers: headers
        expect(response).to have_http_status(:unauthorized)
        get "/api/v1/me", headers: { "Authorization" => renewed }
        expect(response).to have_http_status(:unauthorized)
      end
    end

    it "never renews for a device unused for 30 days" do
      user = create(:user)
      headers = auth_headers(user)
      travel 31.days do
        get "/api/v1/me", headers: headers
        expect(response).to have_http_status(:unauthorized)
        expect(response.headers["Authorization"]).to be_nil
      end
    end
  end

  describe "AC-7.15 renewal and restricted actions" do
    it "keeps a renewing parent allowed through require_verified! and shows the renewal" do
      parent = create(:user, :verified, verification_expires_on: 20.days.from_now.to_date)
      post "/api/v1/verification", params: {
        document_type: "passport", document_front: upload, selfie: upload, date_of_birth: "1990-01-01"
      }, headers: auth_headers(parent)

      expect(response).to have_http_status(:created)
      expect(json.dig("verification", "status")).to eq("verified")
      expect(json.dig("verification", "verified")).to be(true)
      expect(json.dig("verification", "renewal", "status")).to eq("pending")
      get "/api/v1/users/#{parent.id}", headers: auth_headers(create(:user))
      expect(json["verified"]).to be(true)
    end
  end

  describe "admin sessions (regression)" do
    it "AC-9.5 a locked code step refuses even the right code after a new password login" do
      admin = create(:user, :admin)
      post "/admin/login", params: { email: admin.email, password: password }
      5.times { post "/admin/login/code", params: { code: "000001" } }

      post "/admin/login", params: { email: admin.email, password: password }
      post "/admin/login/code", params: { code: admin.reload.current_otp }
      expect(response).to redirect_to("/admin/login")
      get "/admin/verifications"
      expect(response).to redirect_to("/admin/login")
    end

    it "PM review: passing only the password step ends the admin's live back office session" do
      admin = create(:user, :admin)
      admin_log_in(admin)
      live_cookie = cookies["_sparkcircles_admin"]
      get "/admin/verifications"
      expect(response).to have_http_status(:ok)

      # Someone with the password only (no authenticator code), from another browser.
      other = open_session
      other.post "/admin/login", params: { email: admin.email, password: password }

      cookies["_sparkcircles_admin"] = live_cookie
      get "/admin/verifications"
      expect(response).to redirect_to("/admin/login") # documents the current behaviour (see report)
    end

    it "serves the authenticator setup page uncached, with the SparkCircles issuer and a labelled QR code" do
      member = create(:user)
      member.roles.create!(name: "admin")
      post "/admin/login", params: { email: member.email, password: password }
      get "/admin/login/setup"

      expect(response).to have_http_status(:ok)
      expect(response.headers["Cache-Control"]).to include("no-store")
      expect(CGI.unescapeHTML(response.body)).to include("issuer=SparkCircles%20admin")
      expect(response.body).to include("<svg")
      svg = response.body[%r{<svg.*?</svg>}m]
      expect(svg).to be_present
      expect(svg).not_to match(/<script|on\w+=|<foreignObject/i)
      expect(response.body).to match(/aria-label="[^"]*QR[^"]*"|role="img"/i)
    end
  end
end
