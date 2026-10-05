require "rails_helper"

# AC-15.12, AC-15.13: anti-scraping for anonymous requests, members unaffected.
RSpec.describe "Events: guest access and anti-scraping", type: :request do
  let!(:event) { create(:event) }
  let(:search) { { area: "paris-11" } }

  it "AC-15.12 refuses anonymous requests without the app headers" do
    get "/api/v1/events", params: search
    expect(response).to have_http_status(:forbidden)
    expect(error_code).to eq("client_not_allowed")
    get "/api/v1/events/#{event.id}", headers: guest_headers.except("X-SparkCircles-Device")
    expect(error_code).to eq("client_not_allowed")
    get "/api/v1/events", params: search, headers: guest_headers("X-SparkCircles-Client" => "web/1.0")
    expect(error_code).to eq("client_not_allowed")
  end

  it "AC-15.12 blocks known bot and script user agents, even with the app headers" do
    [ "Googlebot/2.1 (+http://www.google.com/bot.html)", "curl/8.4.0", "python-requests/2.31", "Mozilla/5.0 HeadlessChrome/120", "" ].each do |agent|
      get "/api/v1/events", params: search, headers: guest_headers("User-Agent" => agent)
      expect(error_code).to eq("client_not_allowed"), agent
    end
  end

  it "AC-15.12 lets the app through (Android and iOS user agents)" do
    [ "okhttp/4.12.0", "SparkCircles/1 CFNetwork/1498.700.2 Darwin/24.0.0" ].each do |agent|
      get "/api/v1/events", params: search, headers: guest_headers("User-Agent" => agent, "X-SparkCircles-Client" => "ios/1.2.3")
      expect(response).to have_http_status(:ok)
    end
  end

  it "AC-15.12 rate-limits a device with a friendly message" do
    30.times { get "/api/v1/events", params: search, headers: guest_headers }
    expect(response).to have_http_status(:ok)
    get "/api/v1/events", params: search, headers: guest_headers
    expect(response).to have_http_status(:too_many_requests)
    expect(json["error"]).to include("code" => "rate_limited", "message" => "Trop de demandes. Réessaie dans un instant.")
  end

  it "AC-15.12 rate-limits a network address across devices" do
    statuses = Array.new(61) do |index|
      get "/api/v1/events", params: search, headers: guest_headers("X-SparkCircles-Device" => format("00000000-0000-4000-8000-%012d", index))
      response.status
    end
    expect(statuses.last(1)).to eq([ 429 ])
    expect(statuses.first(60).uniq).to eq([ 200 ])
  end

  it "AC-15.12 blocks a guest that keeps hitting the limits for an hour; a member is not affected" do
    33.times { get "/api/v1/events", params: search, headers: guest_headers }
    get "/api/v1/events/#{event.id}", headers: guest_headers
    expect(response).to have_http_status(:forbidden)
    expect(error_code).to eq("client_blocked")
    get "/api/v1/events", params: search, headers: auth_headers(create(:user))
    expect(response).to have_http_status(:ok)
    travel 61.minutes do
      get "/api/v1/events/#{event.id}", headers: guest_headers
      expect(response).to have_http_status(:ok)
    end
  end

  it "AC-15.12 never applies the guest checks to members" do
    get "/api/v1/events", headers: auth_headers(create(:user)).merge("User-Agent" => "curl/8.4.0")
    expect(response).to have_http_status(:ok)
  end

  it "AC-15.13 logs only a hashed address, the endpoint and the kind, kept 30 days" do
    get "/api/v1/events", params: search, headers: { "User-Agent" => "curl/8.4.0" }
    log = GuestAccessEvent.last
    expect(log).to have_attributes(kind: "client_refused", endpoint: "api/v1/events#index")
    expect(log.ip_hash).to match(/\A\h{32}\z/)
    expect(log.attributes.values.join).not_to include("127.0.0.1")
    travel 31.days do
      PurgeGuestAccessEventsJob.perform_now
      expect(GuestAccessEvent.count).to eq(0)
    end
  end
end
