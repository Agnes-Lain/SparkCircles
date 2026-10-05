# Logged-in member who hasn't joined (verified or not), AC-6.1, AC-6.4, AC-6.5: host as
# on a public profile (first name, initial, badge); counts only, no address.
json.partial! "api/v1/events/common", event: event, viewer: viewer
json.partial! "api/v1/events/host", host: event.host
