# Non-members and guests (AC-17.5): name, description, district, families, "Public circle"
# and "Run by a verified parent". Never an admin or member name, initial, avatar or id,
# never routines, events or children's information.
json.id circle.id
json.audience "public"
json.name circle.name
json.description circle.description
json.partial! "api/v1/circles/area", circle: circle
json.visibility circle.visibility
json.families_count circle.families_count
json.max_families Circle::MAX_FAMILIES
json.full circle.full?
json.run_by_verified_parent true
json.viewer Circles::ViewerStatus.for(circle, user)
