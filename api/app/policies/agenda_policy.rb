# My space agenda (spec my-space, PM request "agenda view", AC-1.x, AC-5.2): the outings a
# parent's agenda may list. Read-only, the parent's own data only.
#
# - hosted: the parent's published events, and cancelled ones (AC-1.5);
# - joined: events where the parent holds places (accepted), published or cancelled;
# - circle: published circle-only events of the parent's active circles, not hosted or joined
#   (circles AC-16.3: exactly the events that member may already find in search).
#
# Drafts, suspended events, pending or declined requests and past events are never listed
# (AC-1.6). Cancelled events are kept only while they start within CANCELLED_WINDOW.
class AgendaPolicy
  CANCELLED_WINDOW = 7.days

  attr_reader :user

  def initialize(user, _record = nil)
    @user = user
  end

  # Any logged-in, open account (the account gates run before).
  def show? = user.present? && !user.closed?

  class Scope
    def initialize(user, scope)
      @user = user
      @scope = scope
    end

    def resolve
      return @scope.none if @user.nil? || @user.closed?

      events = @scope.hosted.not_ended.where.not(starts_at: nil)
      mine = events.where(host_id: @user.id).or(events.where(id: joined_ids))
      kept = mine.where(status: "published").or(mine.where(status: "cancelled", starts_at: ..CANCELLED_WINDOW.from_now))
      kept.or(circle_outings(events))
    end

    private

    def joined_ids = @user.event_participations.where(status: "accepted").select(:event_id)

    def circle_outings(events)
      circle_ids = @user.circle_memberships.active.joins(:circle).merge(Circle.active).select(:circle_id)
      events.where(status: "published", visibility: "circles", id: EventCircle.where(circle_id: circle_ids).select(:event_id))
            .where.not(host_id: @user.id).where.not(id: joined_ids)
    end
  end
end
