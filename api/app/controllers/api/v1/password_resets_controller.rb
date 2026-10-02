module Api
  module V1
    # US-4 password reset (AC-4.1 to AC-4.3).
    class PasswordResetsController < BaseController
      skip_before_action :authenticate_user!, :enforce_account_gates!
      rate_limit to: 5, within: 1.hour, only: :create, with: :rate_limited

      # AC-4.1: same answer whether or not the account exists.
      def create
        user = User.find_by(email: params.require(:email).to_s.strip.downcase)
        user&.send_reset_password_instructions
        render json: { status: "link_sent_if_account_exists" }, status: :accepted
      end

      # AC-4.2, AC-4.3
      def update
        password = params.require(:password).to_s
        user = User.with_reset_password_token(params.require(:token).to_s)
        return render_error(:unprocessable_content, :invalid_or_expired_token) unless user&.reset_password_period_valid?

        unless user.reset_password(password, password)
          return render_validation_errors(user)
        end

        user.update_columns(failed_attempts: 0, locked_at: nil, last_failed_attempt_at: nil)
        user.revoke_all_tokens!
        AccountMailer.password_changed(user).deliver_later
        render_me(user, token: user.issue_token!(device_name: params[:device_name]))
      end
    end
  end
end
