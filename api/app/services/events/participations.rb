module Events
  # Join, request, change and leave (US-5, US-17). Every change runs under a row lock on
  # the event (SELECT … FOR UPDATE), so two parents asking for the last places at the same
  # time are served one after the other; the events_places_taken_check constraint is the
  # backstop (AC-5.8: the total taken never exceeds the total).
  #
  # With host approval (AC-17.13), joining sends a request that holds no place (AC-17.14,
  # AC-17.15); the host decides through Events::Requests. More places for an accepted
  # participant are a new request; fewer places never need approval (AC-17.21).
  class Participations
    class Invalid < StandardError
      attr_reader :record

      def initialize(record)
        @record = record
        super("invalid participation")
      end
    end

    # A request can be sent again after these (AC-17.19); never after a decline (PM decision).
    REQUESTABLE_AGAIN = %w[withdrawn expired closed].freeze

    # AC-8.5, AC-8.6: frees every spot the user holds in events that haven't started.
    def self.remove_from_upcoming!(user)
      Event.joins(:participations).where(event_participations: { user_id: user.id })
           .where(starts_at: Time.current..).find_each { |event| new(event, user).remove! }
    end

    def initialize(event, user)
      @event = event
      @user = user
    end

    # AC-2.4, AC-5.1 to AC-5.3, AC-5.5, AC-5.6, AC-5.8, AC-17.2, AC-17.6, AC-17.7, AC-17.14
    def join!(adults:, children:, emergency_phone: nil, acknowledged: false)
      participation = Event.transaction do
        @event.lock!
        raise Error.new(:own_event) if @event.hosted_by?(@user)
        raise Error.new(:event_not_joinable) unless @event.joinable?

        participation = existing_row
        check_can_ask!(participation)
        raise Error.new(:verification_required, status: :forbidden) if @event.verified_only? && !@user.verified?

        participation ||= EventParticipation.new(event: @event, user: @user)
        participation.assign_attributes(adults: adults, children: children, emergency_phone: emergency_phone.presence,
                                        closed_reason: nil, decided_at: nil, pending_adults: nil, pending_children: nil)
        acknowledge!(participation, acknowledged)
        @event.approval_required? ? request!(participation) : accept_now!(participation)
        participation
      end
      notify_joined(participation)
      participation
    end

    # AC-5.2, AC-17.21: change the number of places before the start. More places on an
    # event with approval are a request; the places already accepted stay booked.
    def change!(adults:, children:, emergency_phone: nil)
      previous = nil
      requested = false
      participation = Event.transaction do
        @event.lock!
        participation = find_participation!
        raise Error.new(:event_started) if @event.started?
        raise Error.new(:event_not_joinable) unless @event.joinable?

        previous = participation.requested_places
        participation.emergency_phone = emergency_phone.presence unless emergency_phone.nil?
        proposed = proposed_counts(participation, adults, children)
        if @event.approval_required? && proposed.requested_places > previous
          requested = true
          ask_for_more!(participation, proposed)
        else
          apply_now!(participation, proposed, previous)
        end
        participation
      end
      if requested
        Notifications.request_received(@event, @user, places: participation.asked_places, total: participation.pending_places)
      else
        Notifications.participation_changed(@event, @user, from: previous, to: participation.requested_places)
      end
      participation
    end

    # AC-5.4, AC-6.3: the places are freed at once and the address is no longer returned.
    # A pending request is withdrawn instead (AC-17.14).
    def leave!
      row = existing_row
      return withdraw! if row&.pending?

      participation = Event.transaction do
        @event.lock!
        participation = find_participation!
        raise Error.new(:event_started) if @event.started?

        release!(participation)
        participation
      end
      Notifications.request_resolved(@event, @user)
      # AC-5.4: no reason is asked or shown.
      Notifications.participation_changed(@event, @user, from: participation.requested_places, to: 0)
    end

    # AC-17.14: a pending request (or a request for more places) can be withdrawn at any time.
    def withdraw!
      Event.transaction do
        @event.lock!
        participation = existing_row
        raise Error.new(:request_not_pending) unless participation&.awaiting_host?

        if participation.pending?
          participation.update!(status: "withdrawn", emergency_phone: nil, decided_at: Time.current)
        else
          participation.update!(pending_adults: nil, pending_children: nil, requested_at: nil)
        end
      end
      Notifications.request_resolved(@event, @user)
    end

    # AC-8.5, AC-8.6: removal by the system (closure, revoked verification). The host sees
    # an anonymous "1 person left" in the E1 digest, never the name or the reason.
    def remove!
      participation = Event.transaction do
        @event.lock!
        participation = @event.participations.find_by(user_id: @user.id)
        release!(participation) if participation
        participation
      end
      return unless participation

      Notifications.request_resolved(@event, @user)
      Notifications.participant_removed(@event, @user)
    end

    private

    def existing_row = EventParticipation.find_by(event_id: @event.id, user_id: @user.id)

    def find_participation!
      @event.participations.find_by(user_id: @user.id) || raise(Error.new(:not_joined))
    end

    def check_can_ask!(participation)
      return if participation.nil? || REQUESTABLE_AGAIN.include?(participation.status)
      raise Error.new(:already_requested) if participation.pending?
      raise Error.new(:request_declined) if participation.declined?

      raise Error.new(:already_joined)
    end

    # AC-17.6: the parent ticks "I stay responsible" before joining a drop-off event.
    def acknowledge!(participation, acknowledged)
      return unless @event.dropoff?

      if ActiveModel::Type::Boolean.new.cast(acknowledged)
        participation.responsibility_acknowledged_at = Time.current
      else
        participation.validate
        participation.errors.add(:responsibility_acknowledged, :blank)
        raise Invalid, participation
      end
    end

    # AC-17.14, AC-17.15: no place is held; a request can't ask for more than is left.
    def request!(participation)
      participation.status = "pending"
      participation.requested_at = Time.current
      raise Invalid, participation unless participation.valid?
      check_fits!(participation.requested_places)

      participation.save!
    end

    def accept_now!(participation)
      participation.status = "accepted"
      participation.requested_at = nil
      raise Invalid, participation unless participation.valid?

      take_places!(participation.requested_places)
      participation.save!
    end

    def notify_joined(participation)
      if participation.pending?
        Notifications.request_received(@event, @user, places: participation.requested_places)
      else
        # AC-5.1: the host hears about it in the 15-minute digest (E1).
        Notifications.participation_changed(@event, @user, from: 0, to: participation.requested_places)
      end
    end

    # The new totals, checked with the event's rules before anything is saved.
    def proposed_counts(participation, adults, children)
      proposed = participation.dup
      proposed.assign_attributes(adults: adults, children: children, pending_adults: nil, pending_children: nil)
      raise Invalid, proposed unless proposed.valid?

      proposed
    end

    def ask_for_more!(participation, proposed)
      check_fits!(proposed.requested_places - participation.requested_places)
      participation.update!(pending_adults: proposed.adults, pending_children: proposed.children, requested_at: Time.current)
    end

    def apply_now!(participation, proposed, previous)
      take_places!(proposed.requested_places - previous)
      participation.update!(adults: proposed.adults, children: proposed.children, pending_adults: nil, pending_children: nil)
    end

    def check_fits!(count)
      raise Error.new(:not_enough_places, places_left: @event.places_left) if count > @event.places_left
    end

    def take_places!(count)
      check_fits!(count)
      @event.update_columns(places_taken: @event.places_taken + count, updated_at: Time.current) unless count.zero?
    end

    def release!(participation)
      participation.destroy!
      @event.update_columns(places_taken: @event.places_taken - participation.requested_places, updated_at: Time.current)
    end
  end
end
