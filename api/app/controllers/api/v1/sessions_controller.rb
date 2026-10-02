module Api
  module V1
    # US-3 log in and log out (AC-3.1 to AC-3.6).
    class SessionsController < BaseController
      skip_before_action :authenticate_user!, :enforce_account_gates!, only: :create
      exempt_from_gates :email_not_confirmed, :closure_pending, :terms_acceptance_required, only: :destroy
      exempt_from_gates :terms_acceptance_required, only: :destroy_all
      rate_limit to: 10, within: 3.minutes, only: :create, with: :rate_limited

      def create
        user = User.find_by(email: params.require(:email).to_s.strip.downcase)
        password = params.require(:password).to_s

        unless user
          User.spend_password_check_time(password)
          return render_error(:unauthorized, :invalid_credentials)
        end
        return render_error(:locked, :account_locked) if user.security_locked?

        authenticated = user.valid_for_authentication? { user.valid_password?(password) }
        return render_error(:locked, :account_locked) if user.access_locked?
        return render_error(:unauthorized, :invalid_credentials) unless authenticated

        render_me(user, status: :created, token: user.issue_token!(device_name: params[:device_name]))
      end

      # AC-3.5: only this device.
      def destroy
        current_user.revoke_device!(current_jti)
        head :no_content
      end

      # AC-3.6: every device, this one included.
      def destroy_all
        current_user.revoke_all_tokens!
        head :no_content
      end
    end
  end
end
