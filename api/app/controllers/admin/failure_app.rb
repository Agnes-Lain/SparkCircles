module Admin
  # Where Warden sends back office requests that lost their session (e.g. the
  # 12-hour inactivity timeout): back to the admin login page.
  class FailureApp
    def self.call(env)
      request = ActionDispatch::Request.new(env)
      request.flash[:alert] = "Your session has ended. Log in again." if request.respond_to?(:flash)
      [ 303, { "Location" => "/admin/login", "Content-Type" => "text/html" }, [] ]
    end
  end
end
