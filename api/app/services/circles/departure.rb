module Circles
  # People leaving a circle, and circles ending (spec circles US-5, AC-6.2, AC-6.4, AC-6.7,
  # AC-16.5 to AC-16.7).
  #
  # Circle-only events (PM decision 2026-10-07, AC-16.5): a member who leaves or is removed
  # also leaves the upcoming circle events they joined, unless they are still in another
  # active circle the event was chosen for (AC-16.6); they get an e-mail, the host sees an
  # anonymous "1 person left". A host who is in none of an event's circles any more sees the
  # event cancelled with the neutral cancellation notice (AC-16.7).
  class Departure
    def initialize(circle)
      @circle = circle
    end

    # AC-5.1, AC-6.2: the sole admin must name another admin first; the last member
    # leaving deletes the circle.
    def leave!(membership)
      user = membership.user
      deleted = Circle.transaction do
        @circle.lock!
        membership.lock!
        raise Error.new(:not_found, status: :not_found) unless membership.active?

        others = @circle.active_memberships.where.not(id: membership.id)
        raise Error.new(:sole_admin) if membership.admin? && others.any? && others.admins.none?

        if others.none?
          true
        else
          end_membership!(membership, "left")
          Audit.record!("circle_member_left", @circle, actor: user, subject: user)
          false
        end
      end
      return delete_circle! if deleted

      events_after_departure(user, notify: :left)
    end

    # AC-5.2, AC-5.3: never an admin (the role goes first) nor the creator; the person is
    # blocked for this circle (AC-2.7) and given no reason.
    def remove!(membership, by:)
      Circle.transaction do
        @circle.lock!
        membership.lock!
        raise Error.new(:not_found, status: :not_found) unless membership.active?
        raise Error.new(:member_is_creator) if membership.creator?
        raise Error.new(:member_is_admin) if membership.admin?

        end_membership!(membership, "removed")
        Audit.record!("circle_member_removed", @circle, actor: by, subject: membership.user)
      end
      events_after_departure(membership.user, notify: :removed)
    end

    # AC-6.7 (and the last member leaving): the circle and all its data go. Its circle-only
    # events that aren't shared with another active circle are cancelled.
    def delete_circle!(by: nil)
      cancel_orphan_events!
      Audit.record!("circle_deleted", @circle, actor: by) if by
      @circle.destroy!
    end

    # AC-6.4 (CloseCirclesJob) and AC-7.3 closures: members see "This circle is closed".
    def close!
      @circle.update_columns(status: "closed", closed_at: Time.current, closes_on: nil, updated_at: Time.current)
      cancel_orphan_events!
    end

    # AC-6.4, accounts US-11: at closure the person leaves every circle and their requests
    # are cancelled. A sole admin hands over to the longest-standing verified member (who is
    # told by e-mail); with none, the circle closes after 30 days' notice to its members.
    def self.close_account!(user)
      user.circle_memberships.pending.update_all(status: "cancelled", decided_at: Time.current, updated_at: Time.current)
      user.circle_memberships.active.includes(:circle).find_each do |membership|
        new(membership.circle).leave_for_closure!(membership)
      end
    end

    def leave_for_closure!(membership)
      successor = nil
      empty = Circle.transaction do
        @circle.lock!
        others = @circle.memberships.active.where.not(id: membership.id).joins(:user).where(users: { closed_at: nil })
        if membership.admin? && others.admins.none?
          successor = others.includes(:user).seniority.find { |other| other.user.verified? }
          if successor
            successor.update!(role: "admin", creator: true, admin_since: Time.current)
            Audit.record!("circle_admin_succession", @circle, subject: successor.user)
          elsif others.any?
            @circle.update!(closes_on: Date.current + Circle::CLOSING_NOTICE)
          end
        end
        end_membership!(membership, "left")
        others.none?
      end
      return delete_circle! if empty

      if successor
        Notifications.new_admin(successor)
      elsif @circle.closes_on
        Notifications.closing(@circle)
      end
    end

    private

    def end_membership!(membership, status)
      membership.update!(status: status, role: "member", creator: false, decided_at: Time.current, admin_since: nil)
    end

    def upcoming_events
      Event.hosted.where(id: EventCircle.where(circle_id: @circle.id).select(:event_id))
           .where(status: %w[draft published suspended]).where("events.starts_at IS NULL OR events.starts_at > ?", Time.current)
           .includes(:event_circles)
    end

    # AC-16.5 to AC-16.7. `notify`: :left or :removed (the e-mail wording).
    def events_after_departure(user, notify:)
      remaining = Events::Viewer.new(user).circle_ids
      upcoming_events.find_each do |event|
        # QA B1: the person's drafts lose this circle at once (the draft itself is kept;
        # without a circle left it can't be published, AC-16.1).
        if event.draft? && event.hosted_by?(user)
          event.event_circles.where(circle_id: @circle.id).delete_all
          next
        end
        next if (event.circle_id_list & remaining).any?

        if event.hosted_by?(user)
          cancel_event!(event)
        else
          drop_participant!(event, user, notify)
        end
      end
    end

    def drop_participant!(event, user, notify)
      now = Time.current
      event.all_participations.where(user_id: user.id, status: "pending")
           .update_all(status: "withdrawn", emergency_phone: nil, decided_at: now, updated_at: now)
      return unless event.participations.exists?(user_id: user.id)

      Events::Participations.new(event, user).remove!
      Notifications.event_access_lost(event, user, notify) if notify
    end

    def cancel_event!(event)
      return unless event.published? || event.suspended?

      event.cancel!
      Events::Notifications.event_cancelled(event, neutral: true)
    end

    # Events whose every chosen circle is gone or inactive: cancelled (drafts deleted).
    def cancel_orphan_events!
      upcoming_events.find_each do |event|
        others = Circle.active.where(id: event.circle_id_list - [ @circle.id ])
        next if others.exists?

        event.draft? ? event.destroy! : cancel_event!(event)
      end
    end
  end
end
