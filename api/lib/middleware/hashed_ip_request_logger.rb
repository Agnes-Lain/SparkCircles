# AC-15.13: Rails' "Started GET … for <address>" line would keep every caller's raw network
# address in the request log, next to the (filtered) path. This logger writes the same line
# with the keyed hash used for the guest rate limits instead (GuestAccess.ip_hash), so log
# lines can still be correlated without storing the address.
class HashedIpRequestLogger < Rails::Rack::Logger
  private

  def started_request_message(request)
    format('Started %s "%s" for client %s at %s',
           request.raw_request_method, request.filtered_path, GuestAccess.ip_hash(request.remote_ip), Time.now)
  end
end
