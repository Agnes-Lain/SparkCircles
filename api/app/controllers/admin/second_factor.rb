module Admin
  # Shared by the second-factor steps of W0: the admin passed the password step
  # less than 10 minutes ago.
  module SecondFactor
    extend ActiveSupport::Concern

    PENDING_LIFETIME = 10.minutes
    MAX_CODE_ATTEMPTS = 5

    included do
      skip_before_action :authenticate_admin!
      skip_after_action :verify_authorized
      before_action :load_pending_admin
    end

    private

    def load_pending_admin
      started = session[:admin_pending_at].to_i
      @pending_admin = User.find_by(id: session[:admin_pending_user_id]) if started > PENDING_LIFETIME.ago.to_i
      return if @pending_admin&.admin?

      reset_session
      redirect_to admin_login_path, alert: "Log in again to continue."
    end

    def complete_login!(user)
      reset_session
      warden.set_user(user, scope: :user)
      session[:admin_second_factor_at] = Time.current.to_i
    end

    def too_many_attempts?
      session[:admin_code_attempts] = session[:admin_code_attempts].to_i + 1
      return false if session[:admin_code_attempts] <= MAX_CODE_ATTEMPTS

      reset_session
      true
    end
  end
end
