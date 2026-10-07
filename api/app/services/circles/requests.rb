module Circles
  # Join requests (spec circles US-2, US-3, AC-17.6): asked through an invitation link or
  # code, or from a public circle's page; always decided by an admin with rights.
  #
  # Each change runs under a row lock on the circle, so two approvals can't pass the
  # 25-family limit (AC-4.5) and a person can't slip past their 5-circle limit (AC-3.4).
  class Requests
    def initialize(circle)
      @circle = circle
    end

    # AC-2.3, AC-2.7, AC-3.2, AC-3.4, AC-17.6. A declined or removed person gets the same
    # answer and nothing is created (they are never told they are blocked). Returns the
    # request, or nil for a silent refusal.
    def ask!(user)
      membership = Circle.transaction do
        @circle.lock!
        user.lock!
        membership = @circle.memberships.find_by(user_id: user.id)
        next nil if membership&.blocking?
        raise Error.new(:already_member) if membership&.active?
        raise Error.new(:already_requested) if membership&.pending?
        raise Error.new(:circle_full) if @circle.full?
        raise Error.new(:circle_member_limit) if self.class.circles_count(user) >= Circle::MAX_CIRCLES_PER_PARENT

        membership ||= @circle.memberships.build(user: user)
        membership.update!(status: "pending", role: "member", requested_at: Time.current, decided_at: nil,
                           joined_at: nil, seen_at: nil, dismissed_at: nil)
        membership
      end
      Notifications.request_received(@circle, user) if membership
      membership
    end

    # AC-3.6: no confirmation; the person can ask again.
    def cancel!(user)
      Circle.transaction do
        @circle.lock!
        membership = @circle.memberships.find_by(user_id: user.id)
        raise Error.new(:request_not_pending) unless membership&.pending?

        membership.update!(status: "cancelled", decided_at: Time.current)
      end
    end

    # AC-2.5, AC-2.9: "You're in" by e-mail; refused when the circle is full or the person
    # reached 5 circles in the meantime.
    def accept!(membership, by:)
      Circle.transaction do
        @circle.lock!
        membership.lock!
        raise Error.new(:request_not_pending) unless membership.pending?
        raise Error.new(:circle_full) if @circle.full?
        raise Error.new(:requester_at_limit) if self.class.active_count(membership.user) >= Circle::MAX_CIRCLES_PER_PARENT

        now = Time.current
        membership.update!(status: "active", decided_at: now, joined_at: now, seen_at: nil)
        Audit.record!("circle_member_joined", @circle, actor: by, subject: membership.user)
      end
      Notifications.request_accepted(membership)
    end

    # AC-2.5, AC-2.7: neutral e-mail, no reason; the link can't bring them back.
    def decline!(membership, by:)
      Circle.transaction do
        @circle.lock!
        membership.lock!
        raise Error.new(:request_not_pending) unless membership.pending?

        membership.update!(status: "declined", decided_at: Time.current)
        Audit.record!("circle_request_declined", @circle, actor: by, subject: membership.user)
      end
      Notifications.request_declined(membership)
    end

    # AC-2.6 (daily job): unanswered for 30 days.
    def self.expire_overdue!
      CircleMembership.pending.where(requested_at: ...CircleMembership::REQUEST_LIFETIME.ago).includes(:circle, :user).find_each do |membership|
        membership.update!(status: "expired", decided_at: Time.current)
        Notifications.request_expired(membership)
      end
    end

    # Spec section 7: requests that no longer block anything are deleted 90 days after the decision.
    def self.purge_old!
      CircleMembership.where(status: CircleMembership::REQUESTABLE_AGAIN)
                      .where(decided_at: ...CircleMembership::REQUEST_RETENTION.ago).delete_all
    end

    # AC-3.4: circles a person belongs to or asked to join (a created circle counts, PM 2026-10-07).
    def self.circles_count(user)
      user.circle_memberships.where(status: %w[active pending]).joins(:circle).where.not(circles: { status: "closed" }).count
    end

    def self.active_count(user)
      user.circle_memberships.active.joins(:circle).where.not(circles: { status: "closed" }).count
    end
  end
end
