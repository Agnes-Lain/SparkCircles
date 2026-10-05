module Admin
  # Reported events (spec events US-9): queue, audited detail, tag removal, suspension,
  # cancellation (AC-3.11, AC-9.2 to AC-9.4).
  class EventsController < BaseController
    def index
      authorize Event, policy_class: EventPolicy
      open_reports = EventReport.open
      @events = Event.where(id: open_reports.select(:event_id)).includes(:host, :reports).to_a
      @events.sort_by! { |event| [ urgent?(event) ? 0 : 1, event.reports.select { |report| report.resolved_at.nil? }.map(&:created_at).min ] }
    end

    # Viewing a reported event is an audited access (address and reports included).
    def show
      @event = authorize Event.includes(:host, reports: :reporter).find(params[:id]), policy_class: EventPolicy
      @open_reports = @event.reports.select { |report| report.resolved_at.nil? }.sort_by(&:created_at)
      @urgent = urgent?(@event)
      audit!("viewed_event", subject: @event.host, reason: "safety_report", fields: %w[event exact_address host reports],
             metadata: { event_id: @event.id })
    end

    def remove_tag
      event = authorize Event.find(params[:id]), policy_class: EventPolicy
      tag = params[:tag].to_s
      return redirect_to admin_event_path(event), alert: "This tag isn't on the event." unless event.tags.include?(tag)

      actions.remove_tag!(event, tag)
      redirect_to admin_event_path(event), notice: "Tag removed."
    end

    def suspend
      event = authorize Event.find(params[:id]), policy_class: EventPolicy
      actions.suspend!(event)
      redirect_to admin_event_path(event), notice: "Event suspended. It's hidden and nobody can join."
    end

    def cancel
      event = authorize Event.find(params[:id]), policy_class: EventPolicy
      actions.cancel!(event)
      redirect_to admin_event_path(event), notice: "Event cancelled."
    end

    def resolve_reports
      event = authorize Event.find(params[:id]), policy_class: EventPolicy
      actions.resolve_reports!(event)
      redirect_to admin_events_path, notice: "Reports marked as reviewed."
    end

    private

    def actions = Admin::EventActions.new(admin: current_admin, ip_address: request.remote_ip)

    # AC-9.4: reports from several different members.
    def urgent?(event)
      event.reports.select { |report| report.resolved_at.nil? }.map(&:reporter_id).uniq.size >= EventReport::URGENT_THRESHOLD
    end
  end
end
