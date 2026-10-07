module Admin
  # Reported circles (spec circles US-7, AC-7.2, AC-7.3, AC-17.7).
  class CirclePolicy
    attr_reader :admin, :circle

    def initialize(admin, circle)
      @admin = admin
      @circle = circle
    end

    def index? = admin&.admin? || false
    def show? = index?
    def suspend? = index? && circle.active?
    def resume? = index? && circle.suspended?
    def force_private? = index? && circle.public? && !circle.closed?
    def lift_private? = index? && circle.forced_private?
    def resolve_reports? = index?
  end
end
