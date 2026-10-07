module Api
  module V1
    module Circles
      # The circle's invitation link and code, for its admins (AC-2.1, AC-2.2, AC-2.9, AC-2.10).
      class InvitationsController < BaseController
        include CircleAccess

        rate_limit to: 30, within: 1.hour, by: -> { current_user.id }, name: "circle-invitation", store: GuestAccess::STORE,
                   with: :rate_limited, only: %i[create update]

        before_action :find_circle
        before_action :require_member!
        before_action { authorize @circle, :invite? }

        def show; end

        # Renew: the old link and code stop working at once (AC-2.2).
        def create
          @circle.renew_invitation!
          ::Circles::Audit.record!("circle_invitation_renewed", @circle, actor: current_user)
          render :show
        end

        # Turn the invitation off or on again.
        def update
          enabled = ActiveModel::Type::Boolean.new.cast(params.require(:enabled))
          @circle.update!(invite_enabled: enabled)
          ::Circles::Audit.record!("circle_invitation_toggled", @circle, actor: current_user, enabled: enabled)
          render :show
        end
      end
    end
  end
end
