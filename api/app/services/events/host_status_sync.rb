module Events
  # US-8, called after a user's verification or closure changes (User#sync_events).
  #
  # - Closed account (AC-8.5): upcoming hosted events are cancelled, and the places the
  #   parent took in other upcoming events are freed.
  # - No longer verified, whatever the reason (AC-8.2): upcoming published events are
  #   suspended. A host in renewal is still verified (AC-8.4), so nothing happens.
  # - Verified again (AC-8.3): events suspended for that reason resume if not started.
  # - US-17 (AC-17.22): a parent who is no longer verified has their requests on
  #   "verified members only" events closed, silently (in-app only, PM decision); a closed
  #   account's requests are withdrawn.
  # Emails: cancellations at once without the host's name or a reason (E3b); hold and
  # resume batched per participant and per host (E4 to E7), never with the reason.
  class HostStatusSync
    def initialize(user)
      @user = user
    end

    def call
      if @user.closed?
        close!
      elsif @user.verified?
        resume!
      else
        suspend!
      end
    end

    private

    def upcoming = @user.hosted_events.hosted.upcoming_for_host

    def close!
      upcoming.where(status: %w[published suspended]).find_each do |event|
        event.cancel!
        Notifications.event_cancelled(event, neutral: true)
      end
      Participations.remove_from_upcoming!(@user)
      settle_requests(@user.event_participations, status: "withdrawn")
    end

    def suspend!
      verified_only = Event.where(join_rule: "verified_only").not_ended.select(:id)
      settle_requests(@user.event_participations.where(event_id: verified_only), status: "closed", closed_reason: "verification")
      events = upcoming.where(status: "published").to_a
      events.each { |event| event.suspend!("host_unverified") }
      Notifications.host_status_changed(@user, events, "on_hold")
    end

    def settle_requests(rows, **attributes)
      now = Time.current
      rows.pending.update_all(**attributes, emergency_phone: nil, decided_at: now, updated_at: now)
      rows.accepted.where.not(pending_adults: nil).update_all(pending_adults: nil, pending_children: nil, requested_at: nil, updated_at: now)
    end

    def resume!
      events = upcoming.where(status: "suspended", suspension_reason: "host_unverified").to_a
      events.each(&:resume!)
      Notifications.host_status_changed(@user, events, "resumed")
    end
  end
end
