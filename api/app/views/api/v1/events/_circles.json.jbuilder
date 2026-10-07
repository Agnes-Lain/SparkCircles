# Circles AC-16.4 (members, participants, host; guests never see circle-only events):
# the visibility and the chosen circles the viewer belongs to (all of them for the host).
json.visibility event.visibility
json.circles viewer.circles_for(event) do |circle|
  json.id circle.id
  json.name circle.name
end
