json.accepted @result.accepted
json.closed @result.closed
json.event do
  json.partial! "api/v1/events/event", event: @event, viewer: @viewer
end
