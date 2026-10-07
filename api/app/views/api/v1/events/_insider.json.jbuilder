# Host and participants (AC-6.2, AC-6.4): the exact address and the participant list
# (first name, initial, badge, counts). A participant of a cancelled event loses the
# address (AC-6.3).
role = viewer.audience(event)
mine = viewer.participation(event)
json.partial! "api/v1/events/common", event: event, viewer: viewer
json.partial! "api/v1/events/host", host: event.host
json.partial! "api/v1/events/circles", event: event, viewer: viewer
json.exact_address event.exact_address if role == :host || !event.cancelled?
# AC-17.9, AC-17.12: the host's phone (drop-off) for the host, and for accepted
# participants until 24 hours after the end; never after a cancellation.
if event.dropoff?
  json.host_phone event.host_phone if role == :host || (event.phone_visible? && !event.cancelled?)
  json.phone_visible_until event.phone_visible_until&.utc&.iso8601
end
# AC-17.10: emergency numbers only for the host, until 24 hours after the end.
show_emergency = role == :host && event.phone_visible? && !event.cancelled?
json.participants event.participations.sort_by(&:created_at) do |participation|
  # AC-11.7: someone who closed their account appears as "Former member" in past events.
  person = participation.user
  shown = person.visible_to_others?
  json.first_name(shown ? person.first_name : nil)
  json.last_name_initial(shown ? person.last_name_initial : nil)
  json.verified(shown && person.verified?)
  json.former_member !shown
  json.adults participation.adults
  json.children participation.children
  json.emergency_phone participation.emergency_phone if show_emergency && participation.emergency_phone
end
# AC-17.21: extra places asked while the accepted ones stay booked.
pending_change = mine&.pending_change? && { adults: mine.pending_adults, children: mine.pending_children, places: mine.pending_places,
                                            expires_at: mine.expires_at&.utc&.iso8601 }
json.my_participation(mine && { adults: mine.adults, children: mine.children, places: mine.requested_places,
                                emergency_phone: mine.emergency_phone, pending_change: pending_change || nil })
if role == :host
  # AC-17.15: the number of requests waiting, for the host only.
  json.pending_requests_count event.all_participations.awaiting_host.count
  json.published_at event.published_at&.utc&.iso8601
  json.cancelled_at event.cancelled_at&.utc&.iso8601
end
