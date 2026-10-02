module Api
  module V1
    # US-1 sign-up (AC-1.1 to AC-1.6, AC-5.1 to AC-5.3).
    class RegistrationsController < BaseController
      skip_before_action :authenticate_user!, :enforce_account_gates!
      rate_limit to: 5, within: 1.hour, only: :create, with: :rate_limited

      def create
        result = Accounts::Registration.new(registration_params).call
        if result.success?
          render json: { status: "check_inbox" }, status: :accepted
        else
          render_validation_errors(result.user)
        end
      end

      private

      # Only these fields are read: roles or any other data are ignored (AC-1.5, AC-1.6).
      def registration_params
        params.expect(user: %i[first_name last_name email password adult_confirmed terms_accepted marketing_opt_in locale])
      end
    end
  end
end
