# Coarse search areas (AC-3.3, AC-3.4): a fixed list with an approximate centre each.
# Distances go from area centre to area centre, never from an exact address.
class EventArea
  EARTH_RADIUS_KM = 6371.0

  Area = Data.define(:key, :city, :lat, :lng) do
    def label = I18n.t("events.areas.#{key}")
  end

  class << self
    def all
      @all ||= Rails.application.config_for(:events)[:areas].map do |key, data|
        Area.new(key: key.to_s, city: data[:city], lat: data[:lat], lng: data[:lng])
      end.freeze
    end

    def keys = all.map(&:key)
    def find(key) = all.find { |area| area.key == key.to_s }

    # Keys of the areas whose centre is within `radius_km` of `key`'s centre (itself included).
    def within(key, radius_km)
      origin = find(key)
      return [] unless origin

      all.select { |area| distance_km(origin, area) <= radius_km.to_f }.map(&:key)
    end

    # Rounded to 0.5 km so it never looks more precise than it is.
    def rounded_distance_km(from_key, to_key)
      from = find(from_key)
      to = find(to_key)
      return nil unless from && to

      (distance_km(from, to) * 2).round / 2.0
    end

    def distance_km(from, to)
      d_lat = radians(to.lat - from.lat)
      d_lng = radians(to.lng - from.lng)
      a = Math.sin(d_lat / 2)**2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(d_lng / 2)**2
      2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
    end

    private

    def radians(degrees) = degrees * Math::PI / 180
  end
end
