module Api
  module V1
    module Me
      # AC-7.1: my hosted events (drafts included) and the events I joined, upcoming or
      # past (kept 90 days, AC-7.5).
      class EventsController < BaseController
        ROLES = %w[host participant].freeze
        WHENS = %w[upcoming past].freeze

        def index
          role = params.require(:role)
          time = params[:when].presence || "upcoming"
          return render_error(:bad_request, :bad_request) unless ROLES.include?(role) && WHENS.include?(time)

          page = page_number
          return if performed?

          per_page = ::Events::Search::PER_PAGE
          scope = role == "host" ? current_user.hosted_events : participated_events
          # Drafts with no date yet (BUG-8) are upcoming, after the dated ones.
          scope = if time == "upcoming"
            scope.not_ended.or(scope.where(ends_at: nil)).order(Arel.sql("starts_at ASC NULLS LAST"), :id)
          else
            scope.ended.order(starts_at: :desc, id: :desc)
          end
          rows = scope.includes(:host, event_circles: :circle, participations: :user).offset((page - 1) * per_page).limit(per_page + 1).to_a

          @events = rows.first(per_page)
          @viewer = ::Events::Viewer.new(current_user).preload(@events)
          @pagination = { page: page, per_page: per_page, next_page: rows.size > per_page ? page + 1 : nil }
          render "api/v1/events/index"
        end

        private

        def page_number
          raw = params[:page]
          return render_error(:unprocessable_content, :validation_failed, details: { page: [ "invalid" ] }) unless raw.nil? || raw.is_a?(String)

          ::Events::Search.page_number(raw) ||
            render_error(:unprocessable_content, :validation_failed, details: { page: [ "out_of_range" ] })
        end

        # US-17: pending requests are listed with the joined events; a declined, expired or
        # closed request only while the event is still open.
        def participated_events
          rows = current_user.event_participations
          held = Event.hosted.where.not(status: "draft").where(id: rows.where(status: "accepted").select(:event_id))
          # Web beta Q2: a switched-off drop-off event is listed for its accepted participants only.
          requested = Event.hosted.dropoff_allowed.where.not(status: "draft").where(id: rows.where(status: "pending").select(:event_id))
          answered = Event.hosted.dropoff_allowed.where(status: "published").where(id: rows.where(status: %w[declined expired closed]).select(:event_id))
          held.or(requested).or(answered)
        end
      end
    end
  end
end
