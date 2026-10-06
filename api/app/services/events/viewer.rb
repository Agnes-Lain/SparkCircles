module Events
  # Who is looking at an event, decided on the server only (spec US-15 table, AC-6.x):
  # :guest (no token), :member, :participant or :host. The serializers pick their
  # allow-listed fields from the audience.
  class Viewer
    attr_reader :user, :areas

    # `areas`: the arrondissements of the search, for the distance (AC-3.4).
    def initialize(user, areas: [])
      @user = user
      @areas = Array(areas)
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

    # The viewer's row for the event, whatever its status (requests included).
    def row(event)
      return nil if guest?

      @participations.fetch(event.id) { @participations[event.id] = user.event_participations.find_by(event_id: event.id) }
    end

    # Accepted participation only: the places the viewer holds.
    def participation(event)
      found = row(event)
      found if found&.accepted?
    end

    # US-17: the viewer's own request when it isn't (yet) a participation. Guests and other
    # people never see request states (AC-17.24). A withdrawn request is like none.
    def request(event)
      found = row(event)
      found if found && !found.accepted? && found.status != "withdrawn"
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
      else event.listed? || (request(event)&.pending? && !event.draft?)
      end
    end

    def join_blocker(event)
      return :host if event.hosted_by?(user)
      return :joined if participation(event)
      return :closed unless event.joinable?
      # AC-17.14: one pending request per event; no new request after a decline (PM decision).
      return :requested if request(event)&.pending?
      return :declined if request(event)&.declined?
      return :full if event.full?
      return event.verified_only? ? :verification_required : :account_required if guest?

      :verification_required if event.verified_only? && !user.verified?
    end

    def distance_km(event)
      EventArea.nearest_distance_km(areas, event.area)
    end
  end
end
