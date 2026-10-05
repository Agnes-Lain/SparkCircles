module Events
  # Join, change and leave (US-5). Every change runs under a row lock on the event
  # (SELECT … FOR UPDATE), so two parents asking for the last places at the same time are
  # served one after the other; the events_places_taken_check constraint is the backstop
  # (AC-5.8: the total taken never exceeds the total).
  class Participations
    class Invalid < StandardError
      attr_reader :record

      def initialize(record)
        @record = record
        super("invalid participation")
      end
    end

    # AC-8.5, AC-8.6: frees every spot the user holds in events that haven't started.
    def self.remove_from_upcoming!(user)
      Event.joins(:participations).where(event_participations: { user_id: user.id })
           .where(starts_at: Time.current..).find_each { |event| new(event, user).remove! }
    end

    def initialize(event, user)
      @event = event
      @user = user
    end

    # AC-2.4, AC-5.1 to AC-5.3, AC-5.5, AC-5.6, AC-5.8
    def join!(adults:, children:)
      participation = Event.transaction do
        @event.lock!
        raise Error.new(:own_event) if @event.hosted_by?(@user)
        raise Error.new(:event_not_joinable) unless @event.joinable?
        raise Error.new(:already_joined) if @event.participations.exists?(user_id: @user.id)
        raise Error.new(:verification_required, status: :forbidden) if @event.verified_only? && !@user.verified?

        participation = @event.participations.build(user: @user, adults: adults, children: children)
        raise Invalid, participation unless participation.valid?

        take_places!(participation.requested_places)
        participation.save!
        participation
      end
      # AC-5.1: the host hears about it in the 15-minute digest (E1).
      Notifications.participation_changed(@event, @user, from: 0, to: participation.requested_places)
      participation
    end

    # AC-5.2: change the number of places within what is left, before the start.
    def change!(adults:, children:)
      previous = nil
      participation = Event.transaction do
        @event.lock!
        participation = find_participation!
        raise Error.new(:event_started) if @event.started?
        raise Error.new(:event_not_joinable) unless @event.joinable?

        previous = participation.requested_places
        participation.assign_attributes(adults: adults, children: children)
        raise Invalid, participation unless participation.valid?

        take_places!(participation.requested_places - previous)
        participation.save!
        participation
      end
      Notifications.participation_changed(@event, @user, from: previous, to: participation.requested_places)
      participation
    end

    # AC-5.4, AC-6.3: the places are freed at once and the address is no longer returned.
    def leave!
      participation = Event.transaction do
        @event.lock!
        participation = find_participation!
        raise Error.new(:event_started) if @event.started?

        release!(participation)
        participation
      end
      # AC-5.4: no reason is asked or shown.
      Notifications.participation_changed(@event, @user, from: participation.requested_places, to: 0)
    end

    # AC-8.5, AC-8.6: removal by the system (closure, revoked verification), no reason given
    # and no email to the host (events-emails: hosts are not told why).
    def remove!
      Event.transaction do
        @event.lock!
        participation = @event.participations.find_by(user_id: @user.id)
        release!(participation) if participation
      end
    end

    private

    def find_participation!
      @event.participations.find_by(user_id: @user.id) || raise(Error.new(:not_joined))
    end

    def take_places!(count)
      if count > @event.places_left
        raise Error.new(:not_enough_places, places_left: @event.places_left)
      end

      @event.update_columns(places_taken: @event.places_taken + count, updated_at: Time.current) unless count.zero?
    end

    def release!(participation)
      participation.destroy!
      @event.update_columns(places_taken: @event.places_taken - participation.requested_places, updated_at: Time.current)
    end
  end
end
