# Fields every audience may see (AC-3.4, AC-1.8, AC-4.1). No host, no address, no people.
blocker = viewer.join_blocker(event)
json.id event.id
json.kind "family_hosted"
json.status event.display_status
json.title event.title
json.description event.description
json.category event.category
# AC-16.2: the language the host wrote it in (every audience, guests included).
json.language event.language
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
# US-17 (every audience, guests included): a drop-off event shows its notice (AC-17.5,
# AC-17.24); "approval required" shows the "On request" badge.
json.adult_required event.adult_required
json.approval_required event.approval_required
# AC-17.14, AC-17.24: only the viewer's own request, never anyone else's (guests: none).
request = viewer.request(event)
json.viewer({ role: viewer.audience(event).to_s, joined: viewer.participation(event).present?, can_join: blocker.nil?,
              join_blocker: blocker&.to_s,
              request: request && { status: request.status, closed_reason: request.closed_reason, adults: request.adults,
                                    children: request.children, places: request.requested_places,
                                    requested_at: request.requested_at&.utc&.iso8601,
                                    expires_at: request.expires_at&.utc&.iso8601 } })
