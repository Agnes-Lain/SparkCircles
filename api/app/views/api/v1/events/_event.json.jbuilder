# One allow-listed serializer per audience (spec events US-15 table, AC-15.2, AC-15.11,
# AC-6.1 to AC-6.4). The audience comes from Events::Viewer, never from the request.
case viewer.audience(event)
when :guest then json.partial! "api/v1/events/guest", event: event, viewer: viewer
when :member then json.partial! "api/v1/events/member", event: event, viewer: viewer
else json.partial! "api/v1/events/insider", event: event, viewer: viewer
end
