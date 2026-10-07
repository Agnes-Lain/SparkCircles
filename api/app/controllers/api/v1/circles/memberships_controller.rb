module Api
  module V1
    module Circles
      # My own membership: leave (AC-5.1, AC-6.2) or step down as admin (AC-6.3).
      class MembershipsController < BaseController
        include CircleAccess

        before_action :find_circle
        before_action :require_member!

        def destroy
          ::Circles::Departure.new(@circle).leave!(circle_policy.membership)
          head :no_content
        end

        def step_down
          raise ::Circles::Error.new(@circle.inactive_error_code, status: :forbidden) unless @circle.active?

          ::Circles::Roles.new(@circle).step_down!(circle_policy.membership)
          render_circle
        end
      end
    end
  end
end
