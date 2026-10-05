# Rate limits and guest blocks use a real cache in specs (the test environment's cache is
# a null store), fresh for each example.
module GuestHelpers
  APP_HEADERS = {
    "X-SparkCircles-Client" => "android/1.0.0",
    "X-SparkCircles-Device" => "4f6c9a2e-1b3d-4e5f-8a7b-9c0d1e2f3a4b",
    "User-Agent" => "okhttp/4.12.0"
  }.freeze

  def guest_headers(overrides = {}) = APP_HEADERS.merge(overrides)
end

RSpec.configure do |config|
  config.include GuestHelpers, type: :request
  config.before { GuestAccess.cache_override = ActiveSupport::Cache::MemoryStore.new }
  config.after { GuestAccess.cache_override = nil }
end
