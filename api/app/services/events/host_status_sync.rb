module Events
  # US-8, called after a user's verification or closure changes (User#sync_events).
  #
  # - Closed account (AC-8.5): upcoming hosted events are cancelled, and the places the
  #   parent took in other upcoming events are freed.
  # - No longer verified, whatever the reason (AC-8.2): upcoming published events are
  #   suspended. A host in renewal is still verified (AC-8.4), so nothing happens.
  # - Verified again (AC-8.3): events suspended for that reason resume if not started.
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
    end

    def suspend!
      events = upcoming.where(status: "published").to_a
      events.each { |event| event.suspend!("host_unverified") }
      Notifications.host_status_changed(@user, events, "on_hold")
    end

    def resume!
      events = upcoming.where(status: "suspended", suspension_reason: "host_unverified").to_a
      events.each(&:resume!)
      Notifications.host_status_changed(@user, events, "resumed")
    end
  end
end
