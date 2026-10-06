# Fields every audience may see (AC-3.4, AC-1.8, AC-4.1). No host, no address, no people.
blocker = viewer.join_blocker(event)
json.id event.id
json.kind "family_hosted"
json.status event.display_status
json.title event.title
json.description event.description
json.category event.category
json.tags event.tags
# A draft may have no date or area yet (BUG-8): null until the host fills them in.
json.starts_at event.starts_at&.utc&.iso8601
json.ends_at event.ends_at&.utc&.iso8601
json.time_zone event.time_zone
json.area(event.area && { key: event.area, label: I18n.t("events.areas.#{event.area}") })
json.distance_km viewer.distance_km(event)
json.age_min event.age_min
json.age_max event.age_max
json.join_rule event.join_rule
json.places({ total: event.places_total, taken: event.places_taken, left: event.places_left })
json.full event.full?
json.viewer({ role: viewer.audience(event).to_s, joined: viewer.participation(event).present?, can_join: blocker.nil?,
              join_blocker: blocker&.to_s })
