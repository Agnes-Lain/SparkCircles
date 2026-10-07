module Api
  module V1
    module Circles
      # An admin with rights answers a join request (AC-2.4, AC-2.5, AC-2.9).
      class RequestsController < BaseController
        include CircleAccess

        rate_limit to: 60, within: 10.minutes, by: -> { current_user.id }, name: "circle-decision", store: GuestAccess::STORE,
                   with: :rate_limited

        before_action :find_circle
        before_action :require_member!
        before_action { authorize @circle, :decide_requests? }
        before_action { @request_row = @circle.memberships.find(params[:id]) }

        def accept
          ::Circles::Requests.new(@circle).accept!(@request_row, by: current_user)
          render_circle
        end

        def decline
          ::Circles::Requests.new(@circle).decline!(@request_row, by: current_user)
          render_circle
        end
      end
    end
  end
end
