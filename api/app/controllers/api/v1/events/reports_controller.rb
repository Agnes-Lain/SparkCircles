module Api
  module V1
    module Events
      # US-9: report an event; the host is never told who reported (AC-9.1, AC-9.2, AC-3.11).
      class ReportsController < BaseController
        include EventErrors

        rate_limit to: 10, within: 1.hour, by: -> { current_user.id }, name: "event-report",
                   store: GuestAccess::STORE, with: :rate_limited

        def create
          event = Event.hosted.find(params[:event_id])
          raise ActiveRecord::RecordNotFound unless ::Events::Viewer.new(current_user).can_see?(event)
          raise ::Events::Error.new(:own_event) if event.hosted_by?(current_user)
          raise ::Events::Error.new(:already_reported) if event.reports.exists?(reporter_id: current_user.id)

          report = event.reports.build(reporter: current_user, reason: params[:reason], details: params[:details])
          return render_validation_errors(report) unless report.save

          render json: { report: { id: report.id, reason: report.reason, created_at: report.created_at.utc.iso8601 } },
                 status: :created
        rescue ActiveRecord::RecordNotUnique
          raise ::Events::Error.new(:already_reported)
        end
      end
    end
  end
end
