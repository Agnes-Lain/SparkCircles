module Api
  module V1
    # US-7: identity verification submitted by a parent (AC-7.3 to AC-7.5).
    class VerificationsController < BaseController
      def show
        @user = current_user
      end

      def create
        result = Verifications::Submission.new(user: current_user, params: params).call
        case result.status
        when :pending_exists then render_error(:conflict, :verification_pending)
        when :invalid then render_validation_errors(result.errors)
        else
          @user = current_user.reload
          render :show, status: :created
        end
      end
    end
  end
end
