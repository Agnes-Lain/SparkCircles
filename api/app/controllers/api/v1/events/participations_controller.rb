module Api
  module V1
    module Events
      # Join, change places, leave (US-5, AC-2.4, AC-6.2, AC-6.3).
      class ParticipationsController < BaseController
        include EventErrors

        rate_limit to: 30, within: 10.minutes, by: -> { current_user.id }, name: "participation",
                   store: GuestAccess::STORE, with: :rate_limited

        before_action :set_event

        def create
          ::Events::Participations.new(@event, current_user).join!(**counts)
          render_event(status: :created)
        end

        def update
          ::Events::Participations.new(@event, current_user).change!(**counts)
          render_event
        end

        def destroy
          ::Events::Participations.new(@event, current_user).leave!
          head :no_content
        end

        private

        def set_event
          @event = Event.hosted.find(params[:event_id])
          @viewer = ::Events::Viewer.new(current_user)
          raise ActiveRecord::RecordNotFound unless @viewer.can_see?(@event)
        end

        # Raw values: the model reports non-numbers and missing adults as validation errors.
        def counts
          { adults: params[:adults], children: params[:children] || 0 }
        end

        def render_event(status: :ok)
          @event.reload
          @viewer = ::Events::Viewer.new(current_user)
          render "api/v1/events/show", status: status
        end
      end
    end
  end
end
