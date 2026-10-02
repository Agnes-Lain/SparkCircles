module Admin
  # W0 step 1: email and password. Only admins can continue to the second factor;
  # anyone else gets the same neutral message (AC-9.4).
  class SessionsController < BaseController
    skip_before_action :authenticate_admin!
    skip_after_action :verify_authorized
    rate_limit to: 10, within: 3.minutes, only: :create, with: -> { redirect_to admin_login_path, alert: "Too many attempts. Try again in a few minutes." }

    def new
    end

    def create
      user = User.find_by(email: params[:email].to_s.strip.downcase)
      authenticated = user && !user.security_locked? &&
        user.valid_for_authentication? { user.valid_password?(params[:password].to_s) }

      if authenticated && user.admin?
        reset_session
        session[:admin_pending_user_id] = user.id
        session[:admin_pending_at] = Time.current.to_i
        session[:admin_nonce] = user.start_admin_session!
        redirect_to user.otp_secret.present? ? admin_two_factor_path : admin_two_factor_setup_path
      else
        flash.now[:alert] = user&.access_locked? ? "Too many attempts. Try again in 15 minutes." : "Email or password doesn't match"
        render :new, status: :unprocessable_content
      end
    end

    # BUG-04: logging out invalidates the session on the server, so a copied cookie stops working.
    def destroy
      warden.user(:user)&.end_admin_session!
      warden.logout(:user)
      reset_session
      redirect_to admin_login_path, notice: "You're logged out"
    end
  end
end
