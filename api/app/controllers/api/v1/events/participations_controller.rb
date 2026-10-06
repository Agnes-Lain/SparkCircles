module Api
  module V1
    module Events
      # Join, change places, leave (US-5, AC-2.4, AC-6.2, AC-6.3).
      class ParticipationsController < BaseController
        include EventErrors

        rate_limit to: 30, within: 10.minutes, by: -> { current_user.id }, name: "participation",
                   store: GuestAccess::STORE, with: :rate_limited

        before_action :set_event

        # AC-17.14: with approval, this sends a request (no places held).
        def create
          ::Events::Participations.new(@event, current_user)
                                  .join!(**counts, acknowledged: params[:responsibility_acknowledged])
          render_event(status: :created)
        end

        # AC-17.21: more places on an event with approval are a request.
        def update
          ::Events::Participations.new(@event, current_user).change!(**counts)
          render_event
        end

        # Leaves, or withdraws a pending request (AC-17.14).
        def destroy
          ::Events::Participations.new(@event, current_user).leave!
          head :no_content
        end

        # AC-17.14, AC-17.21: withdraws the pending request or the request for extra places.
        def withdraw
          ::Events::Participations.new(@event, current_user).withdraw!
          render_event
        end

        private

        def set_event
          @event = Event.hosted.find(params[:event_id])
          @viewer = ::Events::Viewer.new(current_user)
          raise ActiveRecord::RecordNotFound unless @viewer.can_see?(@event)
        end

        # Raw values: the model reports non-numbers and missing adults as validation errors.
        def counts
          phone = params[:emergency_phone]
          { adults: params[:adults], children: params[:children] || 0, emergency_phone: phone.is_a?(String) ? phone : nil }
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
