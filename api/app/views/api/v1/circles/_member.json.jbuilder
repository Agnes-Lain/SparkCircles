# Active members (AC-4.1 to AC-4.4, AC-16.4): the circle, its members (first name, initial,
# badge, role, coarse area if shown; never e-mail, phone, full last name, birth date,
# children or verification details, AC-4.2), its upcoming circle outings and, for admins
# with rights, the join requests (AC-2.4).
mine = policy.membership
members = circle.active_memberships.includes(:user).to_a
            .sort_by { |m| [ m.creator? ? 0 : (m.admin? ? 1 : 2), m.joined_at || m.created_at, m.id ] }
viewer = Events::Viewer.new(user)
events = Event.listed.where(visibility: "circles", id: EventCircle.where(circle_id: circle.id).select(:event_id))
              .soonest_first.includes(:host).limit(10).to_a.select(&:host_in_good_standing?).first(5)
viewer.preload(events)
others_verified = members.any? { |m| m.id != mine.id && m.user.verified? }

json.id circle.id
json.audience "member"
json.status circle.status
json.name circle.name
json.description circle.description
json.partial! "api/v1/circles/area", circle: circle
json.visibility circle.visibility
json.premium_entitlement circle.premium_entitlement
# QA B3: forced to private by SparkCircles; the admins can't make it public until staff lift it.
json.forced_private circle.forced_private?
json.families_count members.size
json.max_families Circle::MAX_FAMILIES
json.full members.size >= Circle::MAX_FAMILIES
json.created_at circle.created_at.utc.iso8601
json.my_role mine.display_role
json.creator mine.creator?
json.admin_rights_paused policy.rights_paused?
json.discoverable circle.discoverable?
# AC-6.5, backlog #38: no admin with rights; members see the notice (private circles too).
json.has_verified_admin circle.managed?
json.accepting_requests circle.accepting_requests?
event_json = lambda do |event|
  { id: event.id, title: event.title, starts_at: event.starts_at&.utc&.iso8601, ends_at: event.ends_at&.utc&.iso8601,
    time_zone: event.time_zone, area: { key: event.area, label: I18n.t("events.areas.#{event.area}") } }
end
json.next_event(events.first && event_json.call(events.first))
json.events events do |event|
  json.merge! event_json.call(event)
  json.joined viewer.participation(event).present? || event.hosted_by?(user)
  json.host({ first_name: event.host.first_name, last_name_initial: event.host.last_name_initial, verified: event.host.verified? })
end
json.members members do |member|
  person = member.user
  json.id member.id
  json.first_name person.first_name
  json.last_name_initial person.last_name_initial
  json.photo_url nil
  json.verified person.verified?
  json.city_shown person.city_shown
  json.role member.display_role
  json.creator member.creator?
  json.me member.id == mine.id
end
if policy.manage?
  json.requests circle.memberships.pending.includes(:user).order(:requested_at, :id) do |request|
    json.id request.id
    json.first_name request.user.first_name
    json.last_name_initial request.user.last_name_initial
    json.verified request.user.verified?
    json.requested_at request.requested_at&.utc&.iso8601
    json.expires_at request.expires_at&.utc&.iso8601
  end
else
  json.requests []
end
admins = members.count(&:admin?)
json.can do
  json.manage policy.manage?
  json.invite policy.manage?
  json.edit policy.manage?
  json.delete policy.manage? && !others_verified
  json.leave !(mine.admin? && admins == 1 && members.size > 1)
  json.step_down mine.admin? && admins > 1
  json.promote policy.manage? && admins < Circle::MAX_ADMINS
end
