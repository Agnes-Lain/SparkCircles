module Api
  module V1
    # US-2 email confirmation and US-13 email-change confirmation.
    class EmailConfirmationsController < BaseController
      skip_before_action :authenticate_user!, :enforce_account_gates!
      rate_limit to: 5, within: 1.hour, only: :resend, with: :rate_limited

      def create
        authenticate_from_token
        result = Accounts::EmailConfirmation.new(token: params.require(:token), current_user: current_user,
                                                 current_jti: current_jti).call
        case result.status
        when :signup_confirmed
          render_me(result.user, token: result.user.issue_token!(device_name: params[:device_name]))
        when :email_changed
          render_me(current_user&.reload, token: nil)
        when :email_taken
          render_error(:conflict, :email_taken)
        else
          render_error(:unprocessable_content, :invalid_or_expired_token)
        end
      end

      # Always the same answer, never reveals whether the email is registered.
      def resend
        authenticate_from_token
        user = current_user || User.find_by(email: params[:email].to_s.strip.downcase)
        if user && !user.confirmed?
          user.resend_confirmation_instructions
        end
        render json: { status: "check_inbox" }, status: :accepted
      end
    end
  end
end
