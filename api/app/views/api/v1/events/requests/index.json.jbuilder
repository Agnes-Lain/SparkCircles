# US-17 host request list (AC-17.15, AC-17.16, AC-17.20, AC-17.23): first name, initial,
# badge and counts only; no phone number before accepting, no children's names or ages.
json.places_left @event.places_left
json.frozen @event.requests_frozen?
# AC-6.4b: accepted adults and children now, and per request the totals if it is accepted.
json.totals @totals
json.requests @waiting do |participation|
  json.partial! "api/v1/events/requests/person", user: participation.user
  json.id participation.id
  extra = participation.pending_change?
  json.extra extra
  json.adults extra ? participation.pending_adults : participation.adults
  json.children extra ? participation.pending_children : participation.children
  json.places participation.asked_places
  json.current_places(extra ? participation.requested_places : 0)
  if_adults = @totals[:adults] + (extra ? participation.pending_adults - participation.adults : participation.adults)
  if_children = @totals[:children] + (extra ? participation.pending_children - participation.children : participation.children)
  json.if_accepted({ adults: if_adults, children: if_children })
  json.requested_at participation.requested_at&.utc&.iso8601
  json.expires_at participation.expires_at&.utc&.iso8601
end
json.done @done do |participation|
  json.partial! "api/v1/events/requests/person", user: participation.user
  json.id participation.id
  json.status participation.status
  json.closed_reason participation.closed_reason
  json.places participation.requested_places
  json.decided_at participation.decided_at&.utc&.iso8601
end
