module Api
  module V1
    module Circles
      # Ask to join a public circle from its page (AC-17.6), or cancel my request (AC-3.6).
      class JoinRequestsController < BaseController
        include CircleAccess

        rate_limit to: 30, within: 10.minutes, by: -> { current_user.id }, name: "circle-join", store: GuestAccess::STORE,
                   with: :rate_limited

        before_action :find_circle

        def create
          raise ActiveRecord::RecordNotFound unless circle_policy.show_public? || circle_policy.member?

          authorize @circle, :join?

          ::Circles::Requests.new(@circle).ask!(current_user)
          render json: { request: { status: "pending" } }, status: :created
        end

        def destroy
          ::Circles::Requests.new(@circle).cancel!(current_user)
          head :no_content
        end
      end
    end
  end
end
