module Api
  module V1
    # Hides an expired or declined request, or a neutral card from "My circles" (design C1 « Masquer »).
    class CircleCardsController < BaseController
      def dismiss
        membership = current_user.circle_memberships.includes(:circle).find(params[:id])
        dismissible = membership.status.in?(%w[expired declined removed]) || (membership.active? && !membership.circle.active?)
        raise ActiveRecord::RecordNotFound unless dismissible

        membership.update!(dismissed_at: Time.current)
        head :no_content
      end
    end
  end
end
