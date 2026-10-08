module Api
  module V1
    module Events
      # US-17: the host's request list and decisions (AC-17.15 to AC-17.20, AC-17.23).
      # Host only; anyone else gets 404 (AC-17.24: nobody else sees requests).
      class RequestsController < BaseController
        include EventErrors

        DONE_LIMIT = 50

        rate_limit to: 60, within: 10.minutes, by: -> { current_user.id }, name: "event-requests",
                   store: GuestAccess::STORE, with: :rate_limited, except: :index

        before_action :set_event

        def index
          @waiting = @event.all_participations.awaiting_host.arrival_order.includes(:user).to_a
          @done = @event.all_participations.where.not(status: "pending").where.not(decided_at: nil)
                        .order(decided_at: :desc).limit(DONE_LIMIT).includes(:user).to_a
          # AC-6.4b: the party already accepted, for "Si tu acceptes : N adultes · M enfants".
          adults, children = @event.participations.pick(Arel.sql("COALESCE(SUM(adults), 0)"), Arel.sql("COALESCE(SUM(children), 0)"))
          @totals = { adults: adults.to_i, children: children.to_i }
        end

        # AC-17.16, AC-17.17: "not_enough_places" (with places_left) when it doesn't fit.
        def accept
          ::Events::Requests.new(@event).accept!(params[:id])
          render_event
        end

        def decline
          ::Events::Requests.new(@event).decline!(params[:id])
          render_event
        end

        # AC-17.20: in order of arrival, stopping when places run out.
        def accept_all
          result = ::Events::Requests.new(@event).accept_all!
          @event.reload
          @viewer = ::Events::Viewer.new(current_user)
          @result = result
          render :accept_all
        end

        private

        def set_event
          @event = current_user.hosted_events.hosted.find(params[:event_id])
        end

        def render_event
          @event.reload
          @viewer = ::Events::Viewer.new(current_user)
          render "api/v1/events/show"
        end
      end
    end
  end
end
