module Api
  module V1
    # The owner's own account (docs/api section 2 and 5).
    class MeController < BaseController
      exempt_from_gates :email_not_confirmed, :closure_pending, :terms_acceptance_required, only: :show

      def show
        render_me
      end

      # AC-6.1, AC-7.8. Email changes go through POST /me/email_change.
      def update
        current_user.assign_attributes(profile_params)
        current_user.reset_verification_if_name_changed
        if current_user.save
          render_me
        else
          render_validation_errors(current_user)
        end
      end

      private

      def profile_params
        params.expect(user: %i[first_name last_name city_shown locale])
      end
    end
  end
end
