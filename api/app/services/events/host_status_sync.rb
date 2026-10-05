module Events
  # US-8, called after a user's verification or closure changes (User#sync_events).
  #
  # - Closed account (AC-8.5): upcoming hosted events are cancelled, and the places the
  #   parent took in other upcoming events are freed.
  # - No longer verified, whatever the reason (AC-8.2): upcoming published events are
  #   suspended. A host in renewal is still verified (AC-8.4), so nothing happens.
  # - Verified again (AC-8.3): events suspended for that reason resume if not started.
  # Participant emails ("on hold", "resumed", "cancelled"): not built yet, copy pending.
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
      upcoming.where(status: %w[published suspended]).find_each(&:cancel!)
      Participations.remove_from_upcoming!(@user)
    end

    def suspend!
      upcoming.where(status: "published").find_each { |event| event.suspend!("host_unverified") }
    end

    def resume!
      upcoming.where(status: "suspended", suspension_reason: "host_unverified").find_each(&:resume!)
    end
  end
end
