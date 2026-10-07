module Api
  module V1
    module Circles
      # An admin with rights removes a member (AC-5.2, AC-5.3) or makes them co-admin (AC-6.1).
      class MembersController < BaseController
        include CircleAccess

        before_action :find_circle
        before_action :require_member!
        before_action { authorize @circle, :manage? }
        before_action { @member = @circle.memberships.active.find(params[:id]) }

        def destroy
          ::Circles::Departure.new(@circle).remove!(@member, by: current_user)
          render_circle
        end

        def promote
          ::Circles::Roles.new(@circle).promote!(@member, by: current_user)
          render_circle
        end
      end
    end
  end
end
