# AC-9.1 to AC-9.3: my circles, my requests, and neutral cards without any circle data.
json.items @items do |item|
  membership = item.membership
  circle = membership.circle
  json.id membership.id
  json.state item.state
  case item.state
  when "member"
    preview = circle.active_memberships.includes(:user).seniority.limit(4).to_a
    next_event = Event.listed.where(visibility: "circles", id: EventCircle.where(circle_id: circle.id).select(:event_id))
                      .soonest_first.first
    json.circle do
      json.id circle.id
      json.name circle.name
      json.partial! "api/v1/circles/area", circle: circle
      json.visibility circle.visibility
      json.families_count circle.families_count
      json.my_role membership.display_role
      json.requests_count @list.requests_count(membership)
      json.next_event(next_event && { id: next_event.id, starts_at: next_event.starts_at.utc.iso8601, time_zone: next_event.time_zone })
      json.new membership.seen_at.nil?
      json.members_preview preview do |member|
        json.first_name member.user.first_name
        json.last_name_initial member.user.last_name_initial
        json.seed member.id
      end
    end
  when "pending", "expired"
    json.circle do
      json.id(circle.discoverable? ? circle.id : nil)
      json.name circle.name
      json.partial! "api/v1/circles/area", circle: circle
      json.families_count circle.families_count
    end
  when "declined"
    json.circle { json.name circle.name }
  else
    json.circle nil
  end
end
json.limits @limits
