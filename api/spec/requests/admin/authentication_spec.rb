require "rails_helper"

RSpec.describe "Back office authentication", type: :request do
  let(:admin) { create(:user, :admin) }

  it "AC-9.5 requires the password and then a 6-digit code" do
    post "/admin/login", params: { email: admin.email, password: "correct-horse-battery" }
    expect(response).to redirect_to("/admin/login/code")

    get "/admin/verifications"
    expect(response).to redirect_to("/admin/login")

    post "/admin/login/code", params: { code: "000000" }
    expect(response).to have_http_status(:unprocessable_content)
    expect(response.body).to include("This code doesn&#39;t work")

    post "/admin/login/code", params: { code: admin.reload.current_otp }
    expect(response).to redirect_to("/admin")

    get "/admin/verifications"
    expect(response).to have_http_status(:ok)
  end

  it "AC-9.5 BUG-01 locks the code step for 15 minutes after 5 wrong codes, counted on the server" do
    post "/admin/login", params: { email: admin.email, password: "correct-horse-battery" }
    4.times { post "/admin/login/code", params: { code: "000000" } }
    expect(response).to have_http_status(:unprocessable_content)

    post "/admin/login/code", params: { code: "000000" }
    expect(response).to redirect_to("/admin/login")
    expect(admin.reload).to be_otp_locked

    post "/admin/login", params: { email: admin.email, password: "correct-horse-battery" }
    post "/admin/login/code", params: { code: admin.reload.current_otp }
    expect(response).to redirect_to("/admin/login")

    travel 16.minutes do
      admin_log_in(admin)
      expect(response).to redirect_to("/admin")
      expect(admin.reload.otp_failed_attempts).to eq(0)
    end
  end

  it "BUG-04 logging in again elsewhere ends the previous back office session" do
    admin_log_in(admin)
    first_cookie = cookies["_sparkcircles_admin"]
    reset!
    admin_log_in(admin)

    cookies["_sparkcircles_admin"] = first_cookie
    get "/admin/verifications"
    expect(response).to redirect_to("/admin/login")
  end

  it "AC-9.5 accepts a backup code once" do
    codes = admin.generate_otp_backup_codes!
    admin.save!

    post "/admin/login", params: { email: admin.email, password: "correct-horse-battery" }
    post "/admin/login/code", params: { code: codes.first }
    expect(response).to redirect_to("/admin")

    delete "/admin/logout"
    post "/admin/login", params: { email: admin.email, password: "correct-horse-battery" }
    post "/admin/login/code", params: { code: codes.first }
    expect(response).to have_http_status(:unprocessable_content)
  end

  it "AC-9.5 lets a new admin connect an authenticator app on first login" do
    member = create(:user)
    member.roles.create!(name: "admin")

    post "/admin/login", params: { email: member.email, password: "correct-horse-battery" }
    expect(response).to redirect_to("/admin/login/setup")

    get "/admin/login/setup"
    expect(response.body).to include('role="img" aria-label="QR code to add SparkCircles admin to your authenticator app"', "<svg")
    expect(response.body).to include("Can't scan? Type this key")
    expect(response.body).to match(/<path d="M[^"]+" fill="#000000" transform="translate\(24,24\) scale\(6\)">/)
    expect(response.headers["Cache-Control"]).to include("no-store")
    secret = session[:admin_otp_setup_secret]
    expect(response.body).to include(CGI.escapeHTML("issuer=SparkCircles%20admin"))
    post "/admin/login/setup", params: { code: ROTP::TOTP.new(secret).now }

    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Keep your backup codes")
    expect(member.reload.otp_secret).to eq(secret)
  end

  it "AC-9.4 gives a non-admin the same neutral message as a wrong password" do
    parent = create(:user)

    post "/admin/login", params: { email: parent.email, password: "correct-horse-battery" }
    neutral = response.body
    expect(response).to have_http_status(:unprocessable_content)
    expect(neutral).to include("Email or password doesn&#39;t match")

    post "/admin/login", params: { email: admin.email, password: "wrong-password-1" }
    expect(response.body).to include("Email or password doesn&#39;t match")
  end

  it "AC-9.4 refuses every admin page to someone not logged in" do
    verification = create(:verification)

    [ "/admin/verifications", "/admin/verifications/#{verification.id}", "/admin/members" ].each do |path|
      get path
      expect(response).to redirect_to("/admin/login")
    end
  end

  it "AC-9.7 never accepts a mobile token, even an admin's" do
    get "/admin/verifications", headers: { "Authorization" => "Bearer #{admin.issue_token!}" }

    expect(response).to have_http_status(:forbidden)
  end

  it "AC-9.7 the mobile API gives an admin parent abilities only" do
    headers = auth_headers(admin)

    get "/api/v1/me", headers: headers
    expect(json["roles"]).to include("admin")
    expect(response.body).not_to include("verification_queue")
    expect(Rails.application.routes.routes.map { |route| route.path.spec.to_s }.grep(%r{/api/v1/admin})).to be_empty
  end

  it "logs the admin out after 12 hours without activity" do
    admin_log_in(admin)

    travel 11.hours do
      get "/admin/verifications"
      expect(response).to have_http_status(:ok)
    end
    travel 24.hours do
      get "/admin/verifications"
      expect(response).to redirect_to("/admin/login")
    end
  end

  it "uses CSRF protection on back office forms" do
    ActionController::Base.allow_forgery_protection = true
    post "/admin/login", params: { email: admin.email, password: "correct-horse-battery" }
    expect(response).to have_http_status(:unprocessable_content).or have_http_status(:forbidden)
  ensure
    ActionController::Base.allow_forgery_protection = false
  end
end
