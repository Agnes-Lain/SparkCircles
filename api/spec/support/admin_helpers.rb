module AdminHelpers
  # Goes through the back office login: password, then authenticator code (AC-9.5).
  def admin_log_in(admin, password: strong_test_password)
    post "/admin/login", params: { email: admin.email, password: password }
    post "/admin/login/code", params: { code: admin.reload.current_otp }
  end
end

RSpec.configure do |config|
  config.include AdminHelpers, type: :request
end
