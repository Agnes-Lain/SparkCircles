require "rails_helper"

# Fixes for the QA report docs/qa/events-api.md (BUG-1 to BUG-10), beyond QA's own examples.
RSpec.describe "Events QA fixes", type: :request do
  let(:host) { create(:user, :verified, first_name: "Claire", last_name: "Martin") }
  let!(:event) { create(:event, host: host) }
  let(:member) { create(:user) }
  let(:event_body) do
    { title: "T", category: "sport", starts_at: 2.days.from_now.iso8601, ends_at: (2.days.from_now + 1.hour).iso8601,
      area: "paris-11", exact_address: "1 rue X", places_total: 5, join_rule: "anyone" }
  end

  describe "BUG-8 AC-15.13 request logs" do
    let(:filter) { ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters) }

    it "hides every search filter and the report text, and nothing unrelated" do
      search = { "area" => "paris-11", "category" => "sport", "from" => "2026-10-10", "to" => "2026-10-12",
                 "age_band" => "6-8", "radius_km" => "5", "page" => "2", "q" => "foot", "tag" => "foot",
                 "details" => "texte libre" }
      expect(filter.filter(search).values.uniq).to eq([ "[FILTERED]" ])
      expect(filter.filter("places_total" => 3, "role" => "host", "when" => "past", "id" => "x"))
        .to eq("places_total" => 3, "role" => "host", "when" => "past", "id" => "x")
    end

    it "never writes the raw network address or the search filters in the Started line" do
      io = StringIO.new
      allow(Rails).to receive(:logger).and_return(ActiveSupport::Logger.new(io))
      get "/api/v1/events", params: { area: "paris-11", category: "sport" }, headers: guest_headers,
                            env: { "REMOTE_ADDR" => "203.0.113.7" }
      expect(response).to have_http_status(:ok)
      line = io.string.lines.grep(/Started GET/).first
      expect(line).to include("for client #{GuestAccess.ip_hash('203.0.113.7')}")
      expect(io.string).not_to include("203.0.113.7", "paris-11", "sport")
    end
  end

  describe "BUG-1 AC-3.8, AC-3.9 tag normalisation" do
    it "stores fullwidth letters and other-script digits as plain ASCII" do
      expect(EventTag.normalize("ＦＯＯＴ")).to eq("foot")
      expect(EventTag.normalize("u١٢")).to eq("u12")
    end

    it "refuses look-alike banned words and contact data" do
      expect(EventTag.error_for(EventTag.normalize("ЅЕХ"))).to eq(:banned_word)
      expect(EventTag.error_for(EventTag.normalize("sèxe"))).to eq(:banned_word)
      expect(EventTag.error_for(EventTag.normalize("۰۶۱۲۳۴۵۶۷۸"))).to eq(:contains_phone)
      expect(EventTag.error_for(EventTag.normalize("１２-ｒｕｅ-ｘ"))).to eq(:contains_address)
    end

    it "keeps accepting ordinary tags, accents and other scripts included" do
      %w[foot plein-air café musique-été футбол].each { |tag| expect(EventTag.error_for(EventTag.normalize(tag))).to be_nil }
    end
  end

  describe "BUG-2, BUG-3 malformed search parameters" do
    it "answers 422 validation_failed with an invalid key for array or hash values" do
      { "area=paris-11&page[]=1" => "page", "area=paris-11&page[a]=1" => "page", "area=paris-11&radius_km[]=1" => "radius_km",
        "area[]=paris-11" => "area", "area=paris-11&category[]=sport" => "category",
        "area=paris-11&from[]=2026-10-10" => "from" }.each do |query, key|
        get "/api/v1/events?#{query}", headers: guest_headers
        expect(response).to have_http_status(:unprocessable_content), query
        expect(json.dig("error", "details", key)).to eq([ "invalid" ]), query
      end
    end

    it "answers 400 for a query string Rack can't parse (area=x&area[]=y), as JSON in production" do
      get "/api/v1/events?area=paris-11&area[]=paris-11", headers: guest_headers
      expect(response).to have_http_status(:bad_request)

      env = Rack::MockRequest.env_for("/400", "ORIGINAL_FULLPATH" => "/api/v1/events?area=x&area[]=y")
      status, headers, body = Rails.application.config.exceptions_app.call(env)
      expect([ status, headers["content-type"] ]).to eq([ 400, "application/json; charset=utf-8" ])
      expect(JSON.parse(body.join)).to eq("error" => { "code" => "bad_request", "message" => I18n.t("api.errors.bad_request") })
    end

    it "answers 422 out_of_range for a huge or non-numeric page from a member, on search and my events" do
      [ "99999999999999999999", "10001", "abc", "0" ].each do |page|
        get "/api/v1/events", params: { page: page }, headers: auth_headers(member)
        expect(json.dig("error", "details", "page")).to eq([ "out_of_range" ]), page
        get "/api/v1/me/events", params: { role: "host", page: page }, headers: auth_headers(member)
        expect(json.dig("error", "details", "page")).to eq([ "out_of_range" ]), page
      end
      get "/api/v1/me/events?role=host&page[]=1", headers: auth_headers(member)
      expect(json.dig("error", "details", "page")).to eq([ "invalid" ])
    end

    it "keeps too_far for a guest asking a huge page" do
      get "/api/v1/events", params: { area: "paris-11", page: "99999999999999999999" }, headers: guest_headers
      expect(json.dig("error", "details", "page")).to eq([ "too_far" ])
    end
  end

  describe "BUG-4 AC-1.2 whole numbers only" do
    it "refuses fractional places and ages with not_an_integer" do
      post "/api/v1/events", params: { event: event_body.merge(places_total: "2.5", age_min: 3.5) },
                             headers: auth_headers(create(:user, :verified)), as: :json
      expect(json.dig("error", "details")).to include("places_total" => [ "not_an_integer" ], "age_min" => [ "not_an_integer" ])
    end
  end

  describe "BUG-5 AC-9.1 report details" do
    it "refuses an array in details with validation_failed and stores nothing" do
      expect do
        post "/api/v1/events/#{event.id}/reports", params: { reason: "other", details: [ "a" ] }, headers: auth_headers(member), as: :json
      end.not_to change(EventReport, :count)
      expect(json.dig("error", "details")).to eq("details" => [ "invalid" ])
    end
  end

  describe "BUG-6 AC-5.8 lowering places" do
    it "checks below_taken against the locked row" do
      Event.where(id: event.id).update_all(places_taken: 6)
      patch "/api/v1/events/#{event.id}", params: { event: { places_total: 3 } }, headers: auth_headers(host), as: :json
      expect(json.dig("error", "details")).to eq("places_total" => [ "below_taken" ])
    end
  end

  describe "BUG-9 AC-11.2, AC-11.7 closed members appear as Former member" do
    it "shows a closed host without id or name, and a closed participant without name" do
      participant = create(:user, :verified, first_name: "Thomas")
      create(:event_participation, event: event, user: participant)
      leaver = create(:user, :verified, first_name: "Zoé")
      create(:event_participation, event: event, user: leaver)
      leaver.update_columns(closed_at: Time.current)
      get "/api/v1/events/#{event.id}", headers: auth_headers(participant)
      names = json.dig("event", "participants").map { |person| [ person["first_name"], person["former_member"] ] }
      expect(names).to include([ nil, true ])
      expect(response.body).not_to include("Zoé")

      Accounts::Closure.new(host).close!
      get "/api/v1/events/#{event.id}", headers: auth_headers(participant)
      expect(json.dig("event", "status")).to eq("cancelled")
      expect(json.dig("event", "host")).to eq("id" => nil, "first_name" => nil, "last_name_initial" => nil,
                                              "photo_url" => nil, "verified" => false, "former_member" => true)
      expect(response.body).not_to include("Claire", host.id)
    end
  end

  describe "BUG-10 AC-8.2 a host whose verification just expired" do
    before { travel_to(Time.zone.parse("2026-11-01 07:00")) }

    let(:host) { create(:user, :verified, verification_expires_on: Date.new(2026, 11, 1)) }
    let!(:event) { travel_to(Time.zone.parse("2026-10-20 10:00")) { create(:event, host: host) } }

    it "hides the events at once, before the daily job, for search, detail and join" do
      expect(event.reload.status).to eq("published")
      get "/api/v1/events", params: { area: "paris-11" }, headers: guest_headers
      expect(json["events"]).to be_empty
      get "/api/v1/events/#{event.id}", headers: guest_headers
      expect(response).to have_http_status(:not_found)
      post "/api/v1/events/#{event.id}/participation", params: { adults: 1 }, headers: auth_headers(create(:user, :verified)), as: :json
      expect(response).to have_http_status(:not_found)
    end
  end
end
