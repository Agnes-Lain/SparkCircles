# An invitation link or code (AC-3.1, AC-3.3): name, district, families and the admin's
# first name and initial with badge for a logged-in person (a known contact, PM approval
# note 1; guests see no name, design 4e). No id, no description, no member list.
admin = @circle.admins_with_rights.min_by { |m| [ m.creator? ? 0 : 1, m.admin_since || m.created_at ] }
json.circle do
  json.name @circle.name
  json.partial! "api/v1/circles/area", circle: @circle
  json.visibility @circle.visibility
  json.families_count @circle.families_count
  json.max_families Circle::MAX_FAMILIES
  json.full @circle.full?
  json.admin(admin && current_user && { first_name: admin.user.first_name, last_name_initial: admin.user.last_name_initial, verified: true })
  json.viewer Circles::ViewerStatus.for(@circle, current_user)
end
