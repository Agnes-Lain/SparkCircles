module Events
  # The host's decisions on participation requests (US-17, AC-17.15 to AC-17.23).
  #
  # Everything runs under the event row lock, like joins: an accept checks the places
  # really left (AC-17.17), so two accepts at the same moment never overbook, and the
  # events_places_taken_check constraint stays the last guard. When the places run out,
  # the requests still waiting are closed as "full" (AC-17.18). The parent's emails go out
  # after the commit (E-B to E-E); none of them carries a phone number or the address.
  class Requests
    Result = Struct.new(:accepted, :closed, keyword_init: true)

    def initialize(event)
      @event = event
      @emails = []
    end

    # AC-17.16, AC-17.17: one decision per request; places taken only if they fit.
    # An overdue request is expired (and a requester who lost verification closed) and
    # committed before the refusal is returned.
    def accept!(participation_id)
      outcome = run do
        participation = find_waiting!(participation_id)
        code = settle(participation)
        next code if code

        accept_row!(participation)
        close_if_full!
        participation
      end
      raise Error.new(outcome) if outcome.is_a?(Symbol)

      outcome
    end

    # AC-17.16: no reason; the parent gets a neutral message and can't ask again (PM decision).
    def decline!(participation_id)
      run do
        participation = find_waiting!(participation_id)
        if participation.pending?
          participation.update!(status: "declined", emergency_phone: nil, decided_at: Time.current)
        else
          participation.update!(pending_adults: nil, pending_children: nil, requested_at: nil)
        end
        @emails << [ :request_declined, participation.user, {} ]
        Notifications.request_resolved(@event, participation.user)
        participation
      end
    end

    # AC-17.20: in order of arrival, stopping when places run out; the rest follow AC-17.18.
    def accept_all!
      run do
        accepted = 0
        waiting.each do |participation|
          next if settle(participation)
          break if participation.asked_places > @event.places_left

          accept_row!(participation)
          accepted += 1
        end
        Result.new(accepted: accepted, closed: close_if_full!)
      end
    end

    # AC-17.18 after a host lowers the places, or any change that fills the event.
    def close_if_full
      run { close_if_full! }
    end

    # AC-17.19: called by ExpireEventRequestsJob for overdue requests of published events.
    def expire_overdue
      run do
        waiting.each { |participation| settle(participation) }
      end
    end

    private

    def run
      result = Event.transaction do
        @event.lock!
        yield
      end
      deliver_emails
      result
    end

    def waiting = @event.all_participations.awaiting_host.arrival_order.includes(:user).to_a

    def find_waiting!(participation_id)
      raise Error.new(:requests_frozen) if @event.suspended?
      raise Error.new(:event_not_editable) unless @event.published? && !@event.started?

      participation = @event.all_participations.find(participation_id)
      raise Error.new(:request_not_pending) unless participation.awaiting_host?

      participation
    end

    # An overdue request expires, a requester who lost verification is closed (AC-17.19,
    # AC-17.22). Returns the matching error code when the request was settled that way.
    def settle(participation)
      if participation.expired_now?
        expire!(participation)
        :request_expired
      elsif @event.verified_only? && !participation.user.verified?
        close!(participation, "verification", email: false)
        :request_closed
      end
    end

    def accept_row!(participation)
      asked = participation.asked_places
      if asked > @event.places_left
        raise Error.new(:not_enough_places, places_left: @event.places_left)
      end

      if participation.pending?
        participation.update!(status: "accepted", decided_at: Time.current)
      else
        participation.update!(adults: participation.pending_adults, children: participation.pending_children,
                              pending_adults: nil, pending_children: nil, decided_at: Time.current)
      end
      @event.update_columns(places_taken: @event.places_taken + asked, updated_at: Time.current)
      @emails << [ :request_accepted, participation.user, { places: participation.requested_places } ]
      Notifications.request_resolved(@event, participation.user)
    end

    # AC-17.18: nothing left, so the requests still waiting are closed with "Event full".
    def close_if_full!
      return 0 unless @event.places_left.zero?

      rows = @event.all_participations.awaiting_host.includes(:user).to_a
      rows.each { |participation| close!(participation, "full", email: true) }
      rows.size
    end

    def close!(participation, reason, email:)
      if participation.pending?
        participation.update!(status: "closed", closed_reason: reason, emergency_phone: nil, decided_at: Time.current)
      else
        participation.update!(pending_adults: nil, pending_children: nil, requested_at: nil)
      end
      @emails << [ :request_closed_full, participation.user, {} ] if email
      Notifications.request_resolved(@event, participation.user)
    end

    def expire!(participation)
      if participation.pending?
        participation.update!(status: "expired", emergency_phone: nil, decided_at: Time.current)
      else
        participation.update!(pending_adults: nil, pending_children: nil, requested_at: nil)
      end
      @emails << [ :request_expired, participation.user, {} ]
      Notifications.request_resolved(@event, participation.user)
    end

    def deliver_emails
      emails = @emails
      @emails = []
      emails.each { |kind, user, options| Notifications.request_decided(kind, @event, user, **options) }
    end
  end
end
