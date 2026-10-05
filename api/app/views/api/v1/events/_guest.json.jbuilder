# Guest (no account), AC-15.2: never a host name, initial, avatar or id, never participants
# or the exact address. "Verified members only" events carry no host information at all.
json.partial! "api/v1/events/common", event: event, viewer: viewer
json.host({ verified: event.host_in_good_standing? }) unless event.verified_only?
