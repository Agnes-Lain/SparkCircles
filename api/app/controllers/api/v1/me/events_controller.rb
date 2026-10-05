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
          scope = time == "upcoming" ? scope.not_ended.order(:starts_at, :id) : scope.ended.order(starts_at: :desc, id: :desc)
          rows = scope.includes(:host, participations: :user).offset((page - 1) * per_page).limit(per_page + 1).to_a

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

        def participated_events
          Event.hosted.where.not(status: "draft").where(id: current_user.event_participations.select(:event_id))
        end
      end
    end
  end
end
