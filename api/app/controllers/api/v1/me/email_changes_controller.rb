module Api
  module V1
    module Me
      # US-13: ask to change the account email (AC-13.1, AC-13.2, AC-13.4, AC-13.5).
      class EmailChangesController < BaseController
        rate_limit to: 5, within: 1.hour, only: :create, with: :rate_limited

        def create
          result = Accounts::EmailChangeRequest.new(
            user: current_user, email: params.require(:email), current_password: params.require(:current_password)
          ).call

          case result.status
          when :invalid_password then render_error(:unprocessable_content, :invalid_password)
          when :invalid then render_validation_errors(result.errors)
          else render json: { status: "check_new_inbox" }, status: :accepted
          end
        end
      end
    end
  end
end
