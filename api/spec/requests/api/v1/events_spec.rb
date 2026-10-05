require "rails_helper"

RSpec.describe "Events: create, manage and search", type: :request do
  let(:host) { create(:user, :verified) }
  let(:starts_at) { 5.days.from_now.change(hour: 14) }
  let(:attributes) do
    { title: "Atelier peinture", category: "crafts", starts_at: starts_at.iso8601, ends_at: (starts_at + 2.hours).iso8601,
      area: "paris-11", exact_address: "3 rue de la Roquette, 75011 Paris", places_total: 8, join_rule: "anyone",
      tags: [ "#Peinture", "peinture", "Enfants" ], age_min: 4, age_max: 8 }
  end

  describe "POST /api/v1/events" do
    it "AC-1.2 creates a draft with normalised tags" do
      post "/api/v1/events", params: { event: attributes }, headers: auth_headers(host), as: :json
      expect(response).to have_http_status(:created)
      expect(json["event"]).to include("status" => "draft", "tags" => %w[peinture enfants], "exact_address" => attributes[:exact_address])
      expect(json["event"]["places"]).to eq("total" => 8, "taken" => 0, "left" => 8)
    end

    it "AC-1.1 refuses an unverified parent, even through the API, and creates nothing" do
      expect {
        post "/api/v1/events", params: { event: attributes, publish: true }, headers: auth_headers(create(:user)), as: :json
      }.not_to change(Event, :count)
      expect(response).to have_http_status(:forbidden)
      expect(error_code).to eq("verification_required")
    end

    it "AC-1.1 refuses a guest" do
      post "/api/v1/events", params: { event: attributes }, headers: guest_headers, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "AC-1.2 requires title, category, times, area, address, places and validates limits" do
      post "/api/v1/events", params: { event: { title: "x" * 81, places_total: 101, category: "cooking", area: "lyon-01" } },
                             headers: auth_headers(host), as: :json
      expect(response).to have_http_status(:unprocessable_content)
      expect(json.dig("error", "details")).to include(
        "title" => [ "too_long" ], "places_total" => [ "out_of_range" ], "category" => [ "inclusion" ],
        "area" => [ "inclusion" ], "exact_address" => [ "blank" ], "starts_at" => [ "blank" ]
      )
    end

    it "AC-1.6 refuses a start in the past" do
      post "/api/v1/events", params: { event: attributes.merge(starts_at: 1.hour.ago.iso8601, ends_at: 1.hour.from_now.iso8601) },
                             headers: auth_headers(host), as: :json
      expect(json.dig("error", "details", "starts_at")).to eq([ "in_past" ])
    end

    it "AC-3.9 refuses tags with contact data or banned words, with the reason" do
      post "/api/v1/events", params: { event: attributes.merge(tags: %w[0612345678 merde]) }, headers: auth_headers(host), as: :json
      expect(json.dig("error", "details", "tags")).to contain_exactly("contains_phone", "banned_word")
    end

    it "AC-1.5 publishes in one step with publish: true" do
      post "/api/v1/events", params: { event: attributes, publish: true }, headers: auth_headers(host), as: :json
      expect(json["event"]["status"]).to eq("published")
    end

    it "AC-2.1 ignores a visibility sent by the app (searchable only in v1)" do
      post "/api/v1/events", params: { event: attributes.merge(visibility: "circles") }, headers: auth_headers(host), as: :json
      expect(json["event"]["visibility"]).to eq("searchable")
    end
  end

  describe "POST /api/v1/events/:id/publish" do
    let!(:draft) { create(:event, :draft, host: host) }

    it "AC-1.5 publishes a draft" do
      post "/api/v1/events/#{draft.id}/publish", headers: auth_headers(host)
      expect(response).to have_http_status(:ok)
      expect(draft.reload).to be_published
    end

    it "AC-1.5 re-checks verification: an unverified host's event stays a draft" do
      host.update!(verification_status: "expired")
      post "/api/v1/events/#{draft.id}/publish", headers: auth_headers(host)
      expect(error_code).to eq("verification_required")
      expect(draft.reload).to be_draft
    end

    it "AC-1.6 refuses a draft whose start has passed" do
      draft.update_columns(starts_at: 1.hour.ago, ends_at: 1.hour.from_now)
      post "/api/v1/events/#{draft.id}/publish", headers: auth_headers(host)
      expect(json.dig("error", "details", "starts_at")).to eq([ "in_past" ])
      expect(draft.reload).to be_draft
    end

    it "is 404 for another member" do
      post "/api/v1/events/#{draft.id}/publish", headers: auth_headers(create(:user, :verified))
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PATCH /api/v1/events/:id" do
    let!(:event) { create(:event, host: host, places_total: 10) }

    it "AC-7.2 lets the host edit title, time, place, tags and places" do
      patch "/api/v1/events/#{event.id}", params: { event: { title: "Nouveau titre", places_total: 12, tags: [ "basket" ] } },
                                           headers: auth_headers(host), as: :json
      expect(response).to have_http_status(:ok)
      expect(event.reload).to have_attributes(title: "Nouveau titre", places_total: 12, tags: [ "basket" ])
    end

    it "AC-7.2 refuses fewer places than already taken" do
      create(:event_participation, event: event, adults: 2, children: 2)
      patch "/api/v1/events/#{event.id}", params: { event: { places_total: 3 } }, headers: auth_headers(host), as: :json
      expect(json.dig("error", "details", "places_total")).to eq([ "below_taken" ])
    end

    it "AC-2.5 refuses changing the join rule after publishing" do
      patch "/api/v1/events/#{event.id}", params: { event: { join_rule: "verified_only" } }, headers: auth_headers(host), as: :json
      expect(json.dig("error", "details", "join_rule")).to eq([ "not_editable" ])
    end

    it "AC-8.7 refuses editing a suspended or cancelled event" do
      event.suspend!("host_unverified")
      patch "/api/v1/events/#{event.id}", params: { event: { starts_at: 9.days.from_now.iso8601 } }, headers: auth_headers(host), as: :json
      expect(response).to have_http_status(:conflict)
      expect(error_code).to eq("event_not_editable")
    end

    it "is 404 for someone else" do
      patch "/api/v1/events/#{event.id}", params: { event: { title: "Hack" } }, headers: auth_headers(create(:user, :verified)), as: :json
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/v1/events/:id" do
    it "AC-1.7 deletes a draft permanently" do
      draft = create(:event, :draft, host: host)
      delete "/api/v1/events/#{draft.id}", headers: auth_headers(host)
      expect(response).to have_http_status(:no_content)
      expect(Event.exists?(draft.id)).to be(false)
    end

    it "AC-1.7 refuses deleting a published event" do
      event = create(:event, host: host)
      delete "/api/v1/events/#{event.id}", headers: auth_headers(host)
      expect(error_code).to eq("event_not_draft")
    end
  end

  describe "POST /api/v1/events/:id/cancel" do
    it "AC-7.3 cancels: no new joins, shown as cancelled to participants" do
      event = create(:event, host: host)
      participant = create(:event_participation, event: event).user
      post "/api/v1/events/#{event.id}/cancel", headers: auth_headers(host)
      expect(json["event"]["status"]).to eq("cancelled")
      post "/api/v1/events/#{event.id}/participation", params: { adults: 1 }, headers: auth_headers(create(:user)), as: :json
      expect(response).to have_http_status(:not_found)
      get "/api/v1/events/#{event.id}", headers: auth_headers(participant)
      expect(json["event"]["status"]).to eq("cancelled")
    end
  end

  describe "GET /api/v1/events (search)" do
    let(:member) { create(:user) }
    let!(:soon) { create(:event, host: host, starts_at: 1.day.from_now.change(hour: 10), title: "Foot du samedi", tags: %w[foot]) }
    let!(:later) do
      create(:event, host: host, starts_at: 6.days.from_now.change(hour: 15), category: "music", title: "Éveil musical",
                     tags: %w[chant], age_min: 0, age_max: 3, area: "paris-12")
    end
    let!(:far) { create(:event, host: host, area: "paris-16", title: "Balade au bois", category: "outdoors", tags: %w[nature]) }

    def ids(params = {}, headers = auth_headers(member))
      get "/api/v1/events", params: params, headers: headers
      expect(response).to have_http_status(:ok)
      json["events"].map { |item| item["id"] }
    end

    it "AC-3.1 lists upcoming published events soonest first" do
      expect(ids({})).to eq([ soon.id, far.id, later.id ])
    end

    it "AC-1.6 hides events that have ended" do
      ended = create(:event, :ended, host: host)
      expect(ids({})).not_to include(ended.id)
    end

    it "AC-3.2 filters by area and radius, with the distance from the chosen area (AC-3.4)" do
      expect(ids(area: "paris-11")).to eq([ soon.id ])
      expect(ids(area: "paris-11", radius_km: 3)).to contain_exactly(soon.id, later.id)
      expect(json["events"].find { |item| item["id"] == later.id }["distance_km"]).to eq(2.0)
    end

    it "AC-3.2 filters by category, dates, age band and tag" do
      expect(ids(category: "music,outdoors")).to contain_exactly(later.id, far.id)
      expect(ids(from: 5.days.from_now.to_date.iso8601)).to eq([ later.id ])
      expect(ids(to: 2.days.from_now.to_date.iso8601)).to eq([ soon.id ])
      expect(ids(age_band: "13+")).to contain_exactly(soon.id, far.id)
      expect(ids(tag: "#Foot")).to eq([ soon.id ])
    end

    it "AC-3.10 free text matches title, tags and category labels" do
      expect(ids(q: "musical")).to eq([ later.id ])
      expect(ids(q: "cha")).to eq([ later.id ])
      expect(ids(q: "plein air")).to eq([ far.id ])
    end

    it "AC-3.6 keeps full events, marked full" do
      soon.update_columns(places_taken: soon.places_total)
      get "/api/v1/events", params: { area: "paris-11" }, headers: auth_headers(member)
      expect(json["events"].first).to include("full" => true, "viewer" => hash_including("join_blocker" => "full"))
    end

    it "refuses unknown filter values" do
      get "/api/v1/events", params: { category: "cooking", age_band: "1-99" }, headers: auth_headers(member)
      expect(json.dig("error", "details")).to eq("category" => [ "inclusion" ], "age_band" => [ "inclusion" ])
    end

    it "AC-15.3 gives a guest the same results as a member for the same search" do
      expect(ids({ area: "paris-11", radius_km: 3 }, guest_headers)).to eq(ids(area: "paris-11", radius_km: 3))
    end

    it "AC-15.12 requires an area or 3 characters from a guest" do
      get "/api/v1/events", headers: guest_headers
      expect(error_code).to eq("search_too_broad")
      expect(ids({ q: "samedi" }, guest_headers)).to eq([ soon.id ])
    end

    it "AC-15.12 paginates without a total and caps guests at 5 pages" do
      create_list(:event, 21, host: host, area: "paris-03")
      get "/api/v1/events", params: { area: "paris-03" }, headers: guest_headers
      expect(json["events"].size).to eq(20)
      expect(json["pagination"]).to eq("page" => 1, "per_page" => 20, "next_page" => 2)
      get "/api/v1/events", params: { area: "paris-03", page: 6 }, headers: guest_headers
      expect(json.dig("error", "details", "page")).to eq([ "too_far" ])
    end

    it "AC-15.12 uses random, non-sequential ids" do
      expect([ soon.id, later.id ].map { |id| id[14] }).to all(eq("4"))
    end
  end

  describe "GET /api/v1/me/events" do
    it "AC-7.1 lists the host's drafts and upcoming events, and a participant's joined events" do
      draft = create(:event, :draft, host: host)
      event = create(:event, host: host)
      participant = create(:event_participation, event: event).user
      get "/api/v1/me/events", params: { role: "host" }, headers: auth_headers(host)
      expect(json["events"].map { |item| item["id"] }).to contain_exactly(draft.id, event.id)
      expect(json["events"].first).to have_key("participants")
      get "/api/v1/me/events", params: { role: "participant" }, headers: auth_headers(participant)
      expect(json["events"].map { |item| item["id"] }).to eq([ event.id ])
    end

    it "AC-7.5 lists past events in the history" do
      past = create(:event, :ended, host: host)
      get "/api/v1/me/events", params: { role: "host", when: "past" }, headers: auth_headers(host)
      expect(json["events"].map { |item| [ item["id"], item["status"] ] }).to eq([ [ past.id, "past" ] ])
    end
  end

  describe "GET /api/v1/event_options" do
    it "AC-3.7 lists the 11 categories, the areas and limits, localized" do
      get "/api/v1/event_options", headers: guest_headers("Accept-Language" => "fr")
      expect(json["categories"].size).to eq(11)
      expect(json["categories"].first).to eq("key" => "sport", "label" => "Sport", "help" => "Bouger, jeux de ballon, natation")
      expect(json["areas"].first).to eq("key" => "paris-01", "label" => "Paris 1er", "city" => "Paris")
      expect(json["limits"]).to include("tags" => 5, "places_max" => 100)
    end
  end
end
