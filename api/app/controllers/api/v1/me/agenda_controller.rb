module Api
  module V1
    module Me
      # My space agenda (docs/api/my-space.md): the parent's hosted, joined and circle outings
      # starting in a window of WINDOW_DAYS from `from` (a date, Paris time; today by default),
      # soonest first, and the date of the next outing after the window for paging.
      class AgendaController < BaseController
        include Pundit::Authorization

        WINDOW_DAYS = 30
        MAX_EVENTS = 200
        MAX_AHEAD = 2.years
        # Outings after the window scanned for `next_from` (hosts checked in Ruby, AC-8.2).
        NEXT_SCAN = 50

        rescue_from Pundit::NotAuthorizedError, with: -> { render_error(:forbidden, :forbidden) }

        def show
          authorize :agenda, :show?
          from = from_date
          return if performed?

          window_end = from + WINDOW_DAYS
          scope = listed(policy_scope(Event, policy_scope_class: AgendaPolicy::Scope))
          @events = scope.where(starts_at: from.beginning_of_day...window_end.beginning_of_day)
                         .soonest_first.includes(:host, event_circles: :circle, participations: :user).limit(MAX_EVENTS).to_a
                         .select { |event| shown?(event) }
          @viewer = ::Events::Viewer.new(current_user).preload(@events)
          next_event = scope.where(starts_at: window_end.beginning_of_day..).soonest_first.includes(:host)
                            .limit(NEXT_SCAN).find { |event| shown?(event) }
          @window = { from: from.iso8601, to: (window_end - 1).iso8601, next_from: next_event&.starts_at&.in_time_zone&.to_date&.iso8601 }
          render "api/v1/events/index_agenda"
        end

        private

        def pundit_user = current_user

        # AC-8.2: a circle outing whose host stopped being verified is gone, as in search;
        # the parent's own and joined outings stay. Applied to the window and to `next_from`:
        # SQL keeps hosts whose status is verified, then `shown?` checks the (encrypted) expiry.
        def listed(scope)
          scope.where(host_id: current_user.id).or(scope.where(id: joined_ids.to_a))
               .or(scope.where(host_id: User.in_good_standing.select(:id)))
        end

        def joined_ids
          @joined_ids ||= current_user.event_participations.where(status: "accepted").pluck(:event_id).to_set
        end

        def shown?(event)
          event.host_id == current_user.id || joined_ids.include?(event.id) || event.host_in_good_standing?
        end

        def from_date
          today = Time.zone.today
          raw = params[:from]
          return today if raw.blank?

          date = raw.is_a?(String) && raw.match?(/\A\d{4}-\d{2}-\d{2}\z/) ? Date.iso8601(raw) : nil
          return invalid_from unless date && date <= (today + MAX_AHEAD)

          # The agenda never goes back in time (AC-1.6).
          [ date, today ].max
        rescue Date::Error
          invalid_from
        end

        def invalid_from
          render_error(:unprocessable_content, :validation_failed, details: { from: [ "invalid" ] })
          nil
        end
      end
    end
  end
end
