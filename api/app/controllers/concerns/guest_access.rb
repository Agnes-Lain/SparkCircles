# Anonymous access to the read-only event endpoints (spec events US-15, AC-15.12, AC-15.13).
#
# A guest request must come from the app (X-SparkCircles-Client and X-SparkCircles-Device
# headers) with a user agent that isn't a known bot or script. It is rate-limited per
# network address and per device with Rails' rate_limit; a guest that keeps hitting the
# limits is blocked for an hour. Network addresses are only ever handled as a keyed hash:
# in the rate-limit counters and in the security log (GuestAccessEvent, 30 days).
# Members (valid token) never go through any of this.
module GuestAccess
  extend ActiveSupport::Concern

  CLIENT_HEADER = "X-SparkCircles-Client"
  DEVICE_HEADER = "X-SparkCircles-Device"
  CLIENT_FORMAT = %r{\A(ios|android)/\d{1,3}\.\d{1,3}(\.\d{1,4})?\z}
  DEVICE_FORMAT = /\A\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z/
  BOT_SIGNATURES = Regexp.union(
    /bot\b|bot\/|crawl|spider|slurp|scrap|archiver|facebookexternalhit|bingpreview|mediapartners/i,
    /curl|wget|httpie|python|aiohttp|httpx|scrapy|go-http-client|java\/|apache-httpclient|libwww|perl|ruby|php/i,
    /node-fetch|axios|undici|got \(|headless|phantomjs|selenium|puppeteer|playwright|httrack|postman|insomnia/i
  )
  STRIKES_TO_BLOCK = 3
  STRIKE_WINDOW = 10.minutes
  BLOCK_DURATION = 1.hour
  LOG_THROTTLE = 1.minute

  # Rails' rate_limit takes its store when the class loads; this proxy lets specs swap the
  # cache (the test environment uses a null store).
  mattr_accessor :cache_override

  def self.cache = cache_override || Rails.cache

  STORE = Class.new do
    def increment(...) = GuestAccess.cache.increment(...)
  end.new

  def self.ip_hash(ip)
    @ip_hash_key ||= Rails.application.key_generator.generate_key("guest-access-ip-hash", 32)
    OpenSSL::HMAC.hexdigest("SHA256", @ip_hash_key, ip.to_s).first(32)
  end

  class_methods do
    # Opens `actions` to guests, with guest limits given as { to:, within:, per: :ip | :device }.
    def allow_guests(*actions, limits:)
      self.guest_actions = (guest_actions + actions.map(&:to_s)).uniq
      # Registered once per controller (same method name), checks every guest action.
      before_action :screen_guest!
      limits.each_with_index do |limit, index|
        rate_limit to: limit[:to], within: limit[:within], by: limit[:per] == :device ? :guest_device_key : :guest_ip_key,
                   name: "guest-#{actions.join('-')}-#{index}", store: STORE, with: :guest_rate_limited,
                   only: actions, if: :guest_request?
      end
    end
  end

  private

  def guest_request? = current_user.nil?

  def guest_ip_key = "ip:#{guest_ip_hash}"
  def guest_device_key = "device:#{request.headers[DEVICE_HEADER]}"
  def guest_ip_hash = @guest_ip_hash ||= GuestAccess.ip_hash(request.remote_ip)

  def screen_guest!
    return unless guest_request? && guest_actions.include?(action_name)

    if guest_blocked?
      refuse_guest!(:blocked, :client_blocked)
    elsif !genuine_app_request?
      refuse_guest!(:client_refused, :client_not_allowed)
    end
  end

  def genuine_app_request?
    user_agent = request.user_agent.to_s
    request.headers[CLIENT_HEADER].to_s.match?(CLIENT_FORMAT) && request.headers[DEVICE_HEADER].to_s.match?(DEVICE_FORMAT) &&
      user_agent.present? && !user_agent.match?(BOT_SIGNATURES)
  end

  def guest_blocked?
    GuestAccess.cache.exist?(block_key(guest_ip_key)) || GuestAccess.cache.exist?(block_key(guest_device_key))
  end

  # Abnormal rates: STRIKES_TO_BLOCK limit hits within STRIKE_WINDOW block the address
  # and the device for BLOCK_DURATION.
  def guest_rate_limited
    strikes = [ guest_ip_key, guest_device_key ].map do |key|
      GuestAccess.cache.increment("guest-strikes:#{key}", 1, expires_in: STRIKE_WINDOW).to_i
    end
    if strikes.max >= STRIKES_TO_BLOCK
      [ guest_ip_key, guest_device_key ].each { |key| GuestAccess.cache.write(block_key(key), true, expires_in: BLOCK_DURATION) }
      log_guest_event(:blocked)
    else
      log_guest_event(:rate_limited)
    end
    render_error(:too_many_requests, :rate_limited)
  end

  def refuse_guest!(kind, code)
    log_guest_event(kind)
    render_error(:forbidden, code)
  end

  def block_key(key) = "guest-block:#{key}"

  # AC-15.13: technical data only, at most one row per kind, address and minute.
  def log_guest_event(kind)
    throttle_key = "guest-log:#{kind}:#{guest_ip_hash}"
    return unless GuestAccess.cache.write(throttle_key, true, expires_in: LOG_THROTTLE, unless_exist: true)

    GuestAccessEvent.create!(kind: kind.to_s, ip_hash: guest_ip_hash, endpoint: "#{controller_path}##{action_name}".first(100))
  end
end
