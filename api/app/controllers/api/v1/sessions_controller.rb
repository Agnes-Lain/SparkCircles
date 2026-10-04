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
        # Security fix (PM, 2026-10-04): a lock is only revealed to someone who knows the
        # password. With a wrong password a locked account answers like any wrong password,
        # after the same single bcrypt check as the unknown-email path, and counts nothing.
        # D-8: a "This wasn't me" report lock (AC-13.8) only ends when the team acts, so it has
        # its own code; account_locked stays for too many attempts (AC-3.3), which ends by waiting.
        if user.security_locked? || user.access_locked?
          return render_error(:unauthorized, :invalid_credentials) unless user.valid_password?(password)
          return render_error(:locked, user.security_locked? ? :account_secured : :account_locked)
        end
        # The failure that locks the account (AC-3.3) still answers as a wrong password; the
        # owner gets the email, and the next attempt with the right password sees the lock.
        unless user.valid_for_authentication? { user.valid_password?(password) }
          return render_error(:unauthorized, :invalid_credentials)
        end

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
