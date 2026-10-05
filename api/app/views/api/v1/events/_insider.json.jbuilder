# Host and participants (AC-6.2, AC-6.4): the exact address and the participant list
# (first name, initial, badge, counts). A participant of a cancelled event loses the
# address (AC-6.3).
role = viewer.audience(event)
mine = viewer.participation(event)
json.partial! "api/v1/events/common", event: event, viewer: viewer
json.partial! "api/v1/events/host", host: event.host
json.exact_address event.exact_address if role == :host || !event.cancelled?
json.participants event.participations.sort_by(&:created_at) do |participation|
  json.first_name participation.user.first_name
  json.last_name_initial participation.user.last_name_initial
  json.verified participation.user.verified?
  json.adults participation.adults
  json.children participation.children
end
json.my_participation(mine && { adults: mine.adults, children: mine.children, places: mine.requested_places })
if role == :host
  json.visibility event.visibility
  json.published_at event.published_at&.utc&.iso8601
  json.cancelled_at event.cancelled_at&.utc&.iso8601
end
