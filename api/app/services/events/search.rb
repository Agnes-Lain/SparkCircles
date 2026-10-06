module Events
  # Event search (AC-3.1 to AC-3.6, AC-3.10, AC-15.3, AC-15.12). Runs on our own table
  # only; v2 public events will be imported into it (AC-10.10).
  class Search
    PER_PAGE = 20
    GUEST_MAX_PAGES = 5
    MAX_RADIUS_KM = 10
    Q_LENGTH = 2..50
    GUEST_Q_MIN = 3
    # Members have no page cap, but a page past this is out_of_range (keeps OFFSET sane).
    MAX_PAGE = 10_000
    SCALAR_PARAMS = %i[radius_km category from to age_band tag q language page].freeze
    # Several areas: area[]=paris-11&area[]=paris-20 (a single area=paris-11 still works).
    MAX_AREAS = 20

    class Invalid < StandardError
      attr_reader :details

      def initialize(details)
        @details = details
        super("invalid search")
      end
    end

    class TooBroad < StandardError; end

    Result = Data.define(:events, :page, :next_page)

    def initialize(params, guest:)
      @params = params
      @guest = guest
      @errors = Hash.new { |hash, key| hash[key] = [] }
    end

    # Search filters are plain strings: page[]=1, area[]=… or radius_km[a]=1 are refused as
    # "invalid" (422), never read.
    def self.scalar(params, key)
      value = params[key]
      value.is_a?(String) || value.is_a?(Numeric) ? value : nil
    end

    # Shared by every paginated list: 1..MAX_PAGE, as a whole number.
    def self.page_number(raw)
      return 1 if raw.nil? || raw.to_s.strip.empty?
      return nil unless raw.to_s.strip.match?(/\A\d{1,9}\z/)

      page = raw.to_s.to_i
      page.between?(1, MAX_PAGE) ? page : nil
    end

    # The area keys as sent: one string, or a list of strings (area[]=…). Anything else
    # (area[a]=…, a list of lists) is nil and refused as "invalid".
    def self.area_keys(params)
      value = params[:area]
      return [] if value.nil?
      return value.to_s.strip.empty? ? [] : [ value.to_s ] if value.is_a?(String)
      return nil unless value.is_a?(Array) && value.all?(String)

      value.compact_blank.uniq
    end

    # The search areas: arrondissement keys, or a city key ("paris" = all of Paris).
    def area_keys = self.class.area_keys(@params) || []

    # The arrondissements the distance is measured from (none for a whole city).
    def areas = area_keys.select { |key| EventArea.find(key) }

    def call
      reject_non_scalar_params
      scope = Event.listed
      scope = filter_area(scope)
      scope = filter_categories(scope)
      scope = filter_dates(scope)
      scope = filter_age_band(scope)
      scope = filter_tag(scope)
      scope = filter_language(scope)
      scope = filter_text(scope)
      page = page_number
      raise Invalid, @errors.transform_values(&:uniq) if @errors.any?
      # AC-15.9, AC-15.12: a city ("Tout Paris") counts as a scoped search.
      raise TooBroad if @guest && area_keys.empty? && param(:q).to_s.strip.length < GUEST_Q_MIN

      rows = scope.soonest_first.includes(:host).offset((page - 1) * PER_PAGE).limit(PER_PAGE + 1).to_a
      more = rows.size > PER_PAGE && !(@guest && page >= GUEST_MAX_PAGES)
      # AC-8.2: drops events whose host stopped being verified since the last daily job
      # (a page can then hold fewer than PER_PAGE events; pagination stays stable).
      events = rows.first(PER_PAGE).select(&:host_in_good_standing?)
      Result.new(events: events, page: page, next_page: more ? page + 1 : nil)
    end

    private

    def param(key) = self.class.scalar(@params, key)

    def reject_non_scalar_params
      SCALAR_PARAMS.each { |key| @errors[key] << "invalid" if @params.key?(key) && !@params[key].nil? && param(key).nil? }
      @errors[:area] << "invalid" if self.class.area_keys(@params).nil?
    end

    def filter_area(scope)
      keys = area_keys
      return scope if keys.empty?
      return error(:area, :too_many, scope) if keys.size > MAX_AREAS
      return error(:area, :inclusion, scope) unless keys.all? { |key| EventArea.find(key) || EventArea.city(key) }

      radius = param(:radius_km).presence&.to_f || 0
      return error(:radius_km, :out_of_range, scope) unless (0..MAX_RADIUS_KM).cover?(radius)

      scope.where(area: keys.flat_map { |key| EventArea.city(key) || EventArea.within(key, radius) }.uniq)
    end

    def filter_categories(scope)
      keys = param(:category).to_s.split(",").map(&:strip).compact_blank
      return scope if keys.empty?
      return error(:category, :inclusion, scope) unless (keys - Event::CATEGORIES).empty?

      scope.where(category: keys)
    end

    # Local dates in the events' time zone (Europe/Paris in v1).
    def filter_dates(scope)
      zone = ActiveSupport::TimeZone["Europe/Paris"]
      from = parse_date(:from)
      to = parse_date(:to)
      scope = scope.where(starts_at: zone.local(from.year, from.month, from.day)..) if from
      scope = scope.where(starts_at: ...zone.local(to.year, to.month, to.day) + 1.day) if to
      scope
    end

    def parse_date(key)
      value = param(key).presence
      return nil if value.nil?

      Date.iso8601(value.to_s)
    rescue Date::Error
      @errors[key] << "invalid"
      nil
    end

    # Events with no age range suit every age.
    def filter_age_band(scope)
      band = param(:age_band).presence
      return scope if band.nil?

      range = Event::AGE_BANDS[band.to_s]
      return error(:age_band, :inclusion, scope) unless range

      scope.where("(events.age_min IS NULL OR events.age_min <= ?) AND (events.age_max IS NULL OR events.age_max >= ?)",
                  range.max, range.min)
    end

    def filter_tag(scope)
      tag = EventTag.normalize(param(:tag))
      return scope if tag.blank?

      scope.where("? = ANY (events.tags)", tag)
    end

    # AC-16.3: one language (fr or en); none = every language.
    def filter_language(scope)
      language = param(:language).presence
      return scope if language.nil?
      return error(:language, :inclusion, scope) unless Event::LANGUAGES.include?(language.to_s)

      scope.where(language: language.to_s)
    end

    # AC-3.10: title (contains), tags (starts with) or a category label in FR or EN.
    def filter_text(scope)
      q = param(:q).to_s.squish
      return scope if q.empty?
      return error(:q, :out_of_range, scope) unless Q_LENGTH.cover?(q.length)

      term = Event.sanitize_sql_like(q.downcase)
      tag_term = Event.sanitize_sql_like(EventTag.normalize(q))
      categories = Event::CATEGORIES.select do |key|
        User::LOCALES.any? { |locale| I18n.t("events.categories.#{key}.label", locale: locale).downcase.include?(q.downcase) }
      end
      scope.where("events.title ILIKE :contains OR EXISTS (SELECT 1 FROM unnest(events.tags) AS tag WHERE tag LIKE :prefix) " \
                  "OR events.category IN (:categories)",
                  contains: "%#{term}%", prefix: "#{tag_term}%", categories: categories.presence || [ "" ])
    end

    def page_number
      return 1 if @errors.key?(:page) # already "invalid" (not a plain value)

      raw = param(:page).to_s.strip
      if @guest && raw.match?(/\A\d+\z/) && raw.to_i > GUEST_MAX_PAGES
        @errors[:page] << "too_far"
        return 1
      end
      page = self.class.page_number(raw)
      @errors[:page] << "out_of_range" if page.nil?
      page || 1
    end

    def error(key, type, scope)
      @errors[key] << type.to_s
      scope
    end
  end
end
