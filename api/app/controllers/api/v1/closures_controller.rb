module Api
  module V1
    # US-11: close the account, cancel during the 30-day grace period (AC-11.1 to AC-11.3).
    class ClosuresController < BaseController
      exempt_from_gates :terms_acceptance_required, only: :create
      exempt_from_gates :closure_pending, only: :destroy

      def create
        unless current_user.valid_password?(params.require(:current_password).to_s)
          return render_error(:unprocessable_content, :invalid_password)
        end

        Accounts::Closure.new(current_user).close!
        render json: { closure: { closed_at: current_user.closed_at.utc.iso8601, erasure_on: current_user.erasure_on.iso8601 } },
               status: :accepted
      end

      def destroy
        raise ActiveRecord::RecordNotFound unless current_user.closed?

        current_user.update!(closed_at: nil)
        render_me
      end
    end
  end
end
