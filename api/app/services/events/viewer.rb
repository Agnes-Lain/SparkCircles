module Events
  # Who is looking at an event, decided on the server only (spec US-15 table, AC-6.x):
  # :guest (no token), :member, :participant or :host. The serializers pick their
  # allow-listed fields from the audience.
  class Viewer
    attr_reader :user, :area

    def initialize(user, area: nil)
      @user = user
      @area = area
      @participations = {}
    end

    def guest? = user.nil?

    # Loads the viewer's participations for a page of events in one query.
    def preload(events)
      return self if guest?

      ids = events.map(&:id) - @participations.keys
      found = user.event_participations.where(event_id: ids).index_by(&:event_id)
      ids.each { |id| @participations[id] = found[id] }
      self
    end

    def participation(event)
      return nil if guest?

      @participations.fetch(event.id) { @participations[event.id] = user.event_participations.find_by(event_id: event.id) }
    end

    def audience(event)
      return :guest if guest?
      return :host if event.hosted_by?(user)
      return :participant if participation(event)

      :member
    end

    # AC-1.4, AC-8.2: drafts only for the host; suspended, cancelled and past events only
    # for the host and participants; everyone else sees listed events only.
    def can_see?(event)
      case audience(event)
      when :host then true
      when :participant then !event.draft?
      else event.listed?
      end
    end

    def join_blocker(event)
      return :host if event.hosted_by?(user)
      return :joined if participation(event)
      return :closed unless event.joinable?
      return :full if event.full?
      return event.verified_only? ? :verification_required : :account_required if guest?

      :verification_required if event.verified_only? && !user.verified?
    end

    def distance_km(event)
      area && EventArea.rounded_distance_km(area, event.area)
    end
  end
end
