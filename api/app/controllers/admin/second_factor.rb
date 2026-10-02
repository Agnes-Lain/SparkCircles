module Admin
  # Shared by the second-factor steps of W0. The admin passed the password step less
  # than 10 minutes ago, and the cookie's pending-login nonce is still the one stored on
  # the account (QA BUG-01): replaying an older cookie never brings back a pending login.
  # The live session is only replaced once the code is right (QA R2-03).
  module SecondFactor
    extend ActiveSupport::Concern

    PENDING_LIFETIME = 10.minutes
    LOCKED_MESSAGE = "Too many wrong codes. Try again in 15 minutes.".freeze

    included do
      skip_before_action :authenticate_admin!
      skip_after_action :verify_authorized
      before_action :load_pending_admin
      rate_limit to: 10, within: 15.minutes, only: :create,
                 with: -> { redirect_to admin_login_path, alert: LOCKED_MESSAGE }
    end

    private

    def load_pending_admin
      started = session[:admin_pending_at].to_i
      user = User.find_by(id: session[:admin_pending_user_id]) if started > PENDING_LIFETIME.ago.to_i
      if user&.admin? && user.otp_locked?
        reset_session
        redirect_to admin_login_path, alert: LOCKED_MESSAGE
      elsif user&.admin? && user.admin_login_pending?(session[:admin_login_nonce])
        @pending_admin = user
      else
        reset_session
        redirect_to admin_login_path, alert: "Log in again to continue."
      end
    end

    def complete_login!(user)
      reset_session
      user.reset_otp_failures!
      warden.set_user(user, scope: :user)
      session[:admin_nonce] = user.start_admin_session!
      session[:admin_second_factor_at] = Time.current.to_i
    end

    # Counts the wrong code on the account. Returns true when the code step is now locked.
    def register_wrong_code!
      @pending_admin.register_otp_failure!
      return false unless @pending_admin.otp_locked?

      reset_session
      true
    end
  end
end
