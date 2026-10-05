module Events
  # Event search (AC-3.1 to AC-3.6, AC-3.10, AC-15.3, AC-15.12). Runs on our own table
  # only; v2 public events will be imported into it (AC-10.10).
  class Search
    PER_PAGE = 20
    GUEST_MAX_PAGES = 5
    MAX_RADIUS_KM = 10
    Q_LENGTH = 2..50
    GUEST_Q_MIN = 3

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

    def area = @params[:area].presence

    def call
      scope = Event.listed
      scope = filter_area(scope)
      scope = filter_categories(scope)
      scope = filter_dates(scope)
      scope = filter_age_band(scope)
      scope = filter_tag(scope)
      scope = filter_text(scope)
      page = page_number
      raise Invalid, @errors.transform_values(&:uniq) if @errors.any?
      raise TooBroad if @guest && area.nil? && @params[:q].to_s.strip.length < GUEST_Q_MIN

      rows = scope.soonest_first.includes(:host).offset((page - 1) * PER_PAGE).limit(PER_PAGE + 1).to_a
      more = rows.size > PER_PAGE && !(@guest && page >= GUEST_MAX_PAGES)
      Result.new(events: rows.first(PER_PAGE), page: page, next_page: more ? page + 1 : nil)
    end

    private

    def filter_area(scope)
      return scope if area.nil?
      return error(:area, :inclusion, scope) unless EventArea.find(area)

      radius = @params[:radius_km].presence&.to_f || 0
      return error(:radius_km, :out_of_range, scope) unless (0..MAX_RADIUS_KM).cover?(radius)

      scope.where(area: EventArea.within(area, radius))
    end

    def filter_categories(scope)
      keys = @params[:category].to_s.split(",").map(&:strip).compact_blank
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
      value = @params[key].presence
      return nil if value.nil?

      Date.iso8601(value.to_s)
    rescue Date::Error
      @errors[key] << "invalid"
      nil
    end

    # Events with no age range suit every age.
    def filter_age_band(scope)
      band = @params[:age_band].presence
      return scope if band.nil?

      range = Event::AGE_BANDS[band.to_s]
      return error(:age_band, :inclusion, scope) unless range

      scope.where("(events.age_min IS NULL OR events.age_min <= ?) AND (events.age_max IS NULL OR events.age_max >= ?)",
                  range.max, range.min)
    end

    def filter_tag(scope)
      tag = EventTag.normalize(@params[:tag])
      return scope if tag.blank?

      scope.where("? = ANY (events.tags)", tag)
    end

    # AC-3.10: title (contains), tags (starts with) or a category label in FR or EN.
    def filter_text(scope)
      q = @params[:q].to_s.squish
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
      page = (@params[:page].presence || 1).to_i
      if page < 1
        @errors[:page] << "out_of_range"
      elsif @guest && page > GUEST_MAX_PAGES
        @errors[:page] << "too_far"
      end
      page.clamp(1, Float::INFINITY)
    end

    def error(key, type, scope)
      @errors[key] << type.to_s
      scope
    end
  end
end
