module Circles
  # Circle search (spec circles AC-17.8 to AC-17.10): discoverable circles only, by area
  # (the Events area list, "paris" = all of Paris) and by text on name and description;
  # sorted by the distance of their area to the nearest chosen area, then by size. Same
  # pagination and anti-scraping rules as event search (no total count, 5 pages for guests).
  class Search
    PER_PAGE = 20
    Q_LENGTH = 2..50
    Result = Data.define(:circles, :page, :next_page)

    def initialize(params, guest:)
      @params = params
      @guest = guest
      @errors = Hash.new { |hash, key| hash[key] = [] }
    end

    def call
      %i[q page near].each { |key| @errors[key] << "invalid" if @params.key?(key) && !@params[key].nil? && scalar(key).nil? }
      keys = Events::Search.area_keys(@params)
      @errors[:area] << "invalid" if keys.nil?
      keys ||= []
      scope = filter_area(candidates, keys)
      scope = filter_text(scope)
      page = page_number
      raise Events::Search::Invalid, @errors.transform_values(&:uniq) if @errors.any?

      rows = order(scope, keys).offset((page - 1) * PER_PAGE).limit(PER_PAGE + 1).to_a
      more = rows.size > PER_PAGE && !(@guest && page >= Events::Search::GUEST_MAX_PAGES)
      # AC-17.2: a circle whose admins all lost their verification since is left out.
      circles = rows.first(PER_PAGE).select(&:discoverable?)
      Result.new(circles: circles, page: page, next_page: more ? page + 1 : nil)
    end

    private

    def scalar(key) = Events::Search.scalar(@params, key)

    # Public, active, with an admin whose verification status is "verified" (the expiry date
    # is encrypted: Circle#discoverable? checks it on each page).
    def candidates
      admins = CircleMembership.active.admins.joins(:user)
                               .where(users: { closed_at: nil, verification_status: "verified" }).select(:circle_id)
      Circle.listed_public.where(id: admins)
    end

    def filter_area(scope, keys)
      return scope if keys.empty?
      return error(:area, :too_many, scope) if keys.size > Events::Search::MAX_AREAS
      return error(:area, :inclusion, scope) unless keys.all? { |key| EventArea.find(key) || EventArea.city(key) }

      scope.where(area: keys.flat_map { |key| EventArea.city(key) || [ key ] }.uniq)
    end

    def filter_text(scope)
      q = scalar(:q).to_s.squish
      return scope if q.empty?
      return error(:q, :out_of_range, scope) unless Q_LENGTH.cover?(q.length)

      term = "%#{Circle.sanitize_sql_like(q)}%"
      scope.where("circles.name ILIKE :term OR circles.description ILIKE :term", term: term)
    end

    # Distance from the nearest chosen arrondissement (or `near`), then families, then id.
    def order(scope, keys)
      origins = keys.select { |key| EventArea.find(key) }
      origins = [ scalar(:near).to_s ] if origins.empty? && EventArea.find(scalar(:near).to_s)
      families = CircleMembership.active_members.where("circle_memberships.circle_id = circles.id").select("COUNT(*)")
      scope = scope.select("circles.*", "(#{families.to_sql}) AS families_rank")
      if origins.any?
        distance = Arel::Nodes::Case.new(Circle.arel_table[:area])
        EventArea.keys.each { |key| distance.when(Arel::Nodes.build_quoted(key)).then(EventArea.nearest_distance_km(origins, key) || 0) }
        scope = scope.order(distance.else(999).asc)
      end
      scope.order(Arel.sql("families_rank DESC"), :id)
    end

    def page_number
      return 1 if @errors.key?(:page)

      raw = scalar(:page).to_s.strip
      if @guest && raw.match?(/\A\d+\z/) && raw.to_i > Events::Search::GUEST_MAX_PAGES
        @errors[:page] << "too_far"
        return 1
      end
      page = Events::Search.page_number(raw)
      @errors[:page] << "out_of_range" if page.nil?
      page || 1
    end

    def error(key, type, scope)
      @errors[key] << type.to_s
      scope
    end
  end
end
