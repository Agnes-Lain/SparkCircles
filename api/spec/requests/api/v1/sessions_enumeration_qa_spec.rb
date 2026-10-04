require "rails_helper"

# QA (mobile-account): the login answer must not reveal a locked account to someone who
# doesn't know the password (status, body and headers), and the lockout must still work.
RSpec.describe "Sessions enumeration (QA)", type: :request do
  let!(:user) { create(:user, email: "claire@example.com") }

  def log_in(email: "claire@example.com", password: strong_test_password)
    post "/api/v1/sessions", params: { email: email, password: password, device_name: "iPhone" }, as: :json
    [ response.status, json, response.headers.to_h.transform_keys(&:downcase).except("x-request-id", "x-runtime", "etag", "set-cookie") ]
  end

  it "AC-3.2 AC-3.3 a locked, a report-locked and an unknown account answer a wrong password identically" do
    unknown = log_in(email: "nobody@example.com", password: wrong_test_password)

    user.lock_access!
    attempts_locked = log_in(password: wrong_test_password)
    user.unlock_access!
    user.update!(security_locked_at: Time.current)
    report_locked = log_in(password: wrong_test_password)

    expect(attempts_locked).to eq(unknown)
    expect(report_locked).to eq(unknown)
    expect(user.reload.failed_attempts).to eq(0)
  end

  it "AC-3.3 five wrong passwords lock the account; wrong ones keep answering 401, the right one 423" do
    5.times { expect(log_in(password: wrong_test_password).first).to eq(401) }
    expect(user.reload.access_locked?).to be(true)
    expect(log_in(password: wrong_test_password).first).to eq(401)
    status, body, = log_in
    expect([ status, body.dig("error", "code") ]).to eq([ 423, "account_locked" ])
    expect(user.allowlisted_jwts.count).to eq(0)
  end
end
