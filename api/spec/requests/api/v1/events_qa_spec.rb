require "rails_helper"

# QA additions for the Events v1 backend (docs/qa/events-api.md). Examples marked `pending`
# document an open bug: they flip to a failure as soon as the bug is fixed, so remove the
# `pending` line then.
RSpec.describe "Events QA", type: :request do
  let(:host) { create(:user, :verified, first_name: "Claire", last_name: "Martin") }
  let!(:event) { create(:event, host: host) }
  let(:member) { create(:user) }
  let(:event_body) do
    { title: "T", category: "sport", starts_at: 2.days.from_now.iso8601, ends_at: (2.days.from_now + 1.hour).iso8601,
      area: "paris-11", exact_address: "1 rue X", places_total: 5, join_rule: "anyone" }
  end

  describe "AC-15.2 caching and error bodies" do
    it "answers with a private cache policy and a different ETag per audience" do
      get "/api/v1/events/#{event.id}", headers: guest_headers
      guest_etag = response.headers["ETag"]
      expect(response.headers["Cache-Control"]).to include("private")
      get "/api/v1/events/#{event.id}", headers: auth_headers(member)
      expect(response.headers["ETag"]).not_to eq(guest_etag)
      get "/api/v1/events/#{event.id}", headers: guest_headers.merge("If-None-Match" => response.headers["ETag"])
      expect(response).to have_http_status(:ok)
    end

    it "AC-1.4 gives the same 404 body for a draft as for an unknown id (no existence oracle)" do
      draft = create(:event, :draft, host: host)
      get "/api/v1/events/#{draft.id}", headers: guest_headers
      draft_body = response.body
      get "/api/v1/events/#{SecureRandom.uuid}", headers: guest_headers
      expect(response.body).to eq(draft_body)
    end

    it "AC-15.11 ignores include, fields and format parameters" do
      get "/api/v1/events/#{event.id}.json", params: { include: "participants,host", fields: "exact_address" }, headers: guest_headers
      expect(response.body).not_to include("Claire", "Oberkampf", "participants", "exact_address")
    end
  end

  describe "AC-15.12 the app headers only gate anonymous access" do
    it "never grants access to member endpoints, with or without a bad token" do
      get "/api/v1/me/events", params: { role: "host" }, headers: guest_headers
      expect(response).to have_http_status(:unauthorized)
      post "/api/v1/events", params: { event: event_body }, headers: guest_headers, as: :json
      expect(response).to have_http_status(:unauthorized)
      post "/api/v1/events/#{event.id}/participation", params: { adults: 1 }, headers: guest_headers, as: :json
      expect(response).to have_http_status(:unauthorized)
      get "/api/v1/events/#{event.id}", headers: guest_headers.merge("Authorization" => "Bearer garbage")
      expect(response).to have_http_status(:unauthorized)
    end

    it "treats a non-bearer Authorization header as a guest (guest checks apply)" do
      get "/api/v1/events", params: { area: "paris-11" }, headers: { "Authorization" => "Basic abc", "User-Agent" => "curl/8" }
      expect(response).to have_http_status(:forbidden)
      expect(error_code).to eq("client_not_allowed")
    end

    it "keeps the page cap at exactly 5 and never returns a total" do
      get "/api/v1/events", params: { area: "paris-11", page: 5 }, headers: guest_headers
      expect(response).to have_http_status(:ok)
      expect(json["pagination"]).to eq("page" => 5, "per_page" => 20, "next_page" => nil)
      expect(json.keys).to eq(%w[events pagination])
      get "/api/v1/events", params: { area: "paris-11", page: 6 }, headers: guest_headers
      expect(json.dig("error", "details")).to eq("page" => [ "too_far" ])
    end

    it "does not log the search text, and logs a keyed hash only" do
      filtered = ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters).filter("q" => "claire", "tag" => "foot", "area" => "paris-11")
      # BUG-8: the search filters are hidden too.
      expect(filtered).to eq("q" => "[FILTERED]", "tag" => "[FILTERED]", "area" => "[FILTERED]")
    end

    it "hides several areas (area[]) in the logged path too" do
      env = Rack::MockRequest.env_for("/api/v1/events?area[]=paris-11&area%5B%5D=paris-20&topic=x")
      env["action_dispatch.parameter_filter"] = Rails.application.config.filter_parameters
      expect(ActionDispatch::Request.new(env).filtered_path)
        .to eq("/api/v1/events?area[]=[FILTERED]&area%5B%5D=[FILTERED]&topic=x")
    end
  end

  describe "AC-3.8, AC-3.9 tag filters" do
    let(:verified) { create(:user, :verified) }

    def create_with_tags(tags) = post("/api/v1/events", params: { event: event_body.merge(tags: tags) }, headers: auth_headers(create(:user, :verified)), as: :json)

    it "refuses a phone number written with ASCII digits" do
      create_with_tags([ "0612345678" ])
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "BUG-1 refuses a phone number written with fullwidth or Arabic-Indic digits" do
      [ "０６１２３４５６７８", "٠٦١٢٣٤٥٦٧٨" ].each do |tag|
        create_with_tags([ tag ])
        expect(response).to have_http_status(:unprocessable_content), "#{tag} was accepted"
      end
    end

    it "BUG-1 refuses a banned word written with a Cyrillic letter or fullwidth letters" do
      [ "sеx", "ｓｅｘ" ].each do |tag|
        create_with_tags([ tag ])
        expect(response).to have_http_status(:unprocessable_content), "#{tag} was accepted"
      end
    end
  end

  describe "malformed parameters never crash the API" do
    it "BUG-2 answers a JSON 4xx for page[]=1 and radius_km[]=1 (search)" do
      [ "page[]=1", "page[a]=1", "radius_km[]=1" ].each do |query|
        expect { get "/api/v1/events?area=paris-11&#{query}", headers: guest_headers }.not_to raise_error
      end
    end

    it "BUG-3 answers a 4xx for an absurdly large page number from a member" do
      expect { get "/api/v1/events", params: { page: "99999999999999999999" }, headers: auth_headers(member) }.not_to raise_error
      expect(response.status).to be_between(400, 499)
    end
  end

  describe "AC-1.2 places" do
    it "BUG-4 refuses a fractional number of places instead of truncating it" do
      post "/api/v1/events", params: { event: event_body.merge(places_total: 1.5) }, headers: auth_headers(create(:user, :verified)), as: :json
      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "AC-9.1 report details" do
    it "BUG-5 refuses details that are not a string" do
      post "/api/v1/events/#{event.id}/reports", params: { reason: "other", details: { a: "b" } }, headers: auth_headers(member)
      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "AC-5.8 the host lowering the places while parents join" do
    it "BUG-6 answers 422 below_taken, not a database error, when the check races a join" do
      target = create(:event, host: host, places_total: 10)
      allow_any_instance_of(Event).to receive(:places_taken).and_return(0)
      Event.where(id: target.id).update_all(places_taken: 6)
      expect do
        patch "/api/v1/events/#{target.id}", params: { event: { places_total: 3 } }, headers: auth_headers(host), as: :json
      end.not_to raise_error
      expect(response).to have_http_status(:unprocessable_content)
    end
  end
end
