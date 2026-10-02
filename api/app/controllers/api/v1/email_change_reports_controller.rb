module Api
  module V1
    # AC-13.8: "This wasn't me" from the notice sent to the old address. No login needed.
    class EmailChangeReportsController < BaseController
      skip_before_action :authenticate_user!, :enforce_account_gates!
      rate_limit to: 5, within: 1.hour, only: :create, with: :rate_limited

      def create
        change = EmailChange.find_by_token_for(:report, params.require(:token).to_s)
        return render_error(:unprocessable_content, :invalid_or_expired_token) unless change

        Accounts::EmailChangeReport.new(change, ip_address: request.remote_ip).call
        render json: { status: "account_secured" }, status: :accepted
      end
    end
  end
end
