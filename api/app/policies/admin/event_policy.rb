module Admin
  # Reported events (spec events US-9, AC-3.11, AC-9.3).
  class EventPolicy
    attr_reader :admin, :event

    def initialize(admin, event)
      @admin = admin
      @event = event
    end

    def index? = admin&.admin? || false
    def show? = index?
    def remove_tag? = index?
    def suspend? = index? && event.published?
    def cancel? = index? && (event.published? || event.suspended?)
    def resolve_reports? = index?
  end
end
