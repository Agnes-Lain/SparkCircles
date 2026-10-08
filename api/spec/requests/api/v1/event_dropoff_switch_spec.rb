require "rails_helper"

# Web beta Q2 (PM decision 2026-10-08): the server-side drop-off switch (DROPOFF_ENABLED),
# off by default. Off: no drop-off event can be created or published, and the existing ones
# exist only for their host and accepted participants. On: drop-off events work as today.
RSpec.describe "Events: drop-off switch", type: :request do
  let(:host) { create(:user, :verified) }
  let(:member) { create(:user, :verified) }
  let(:participant) { create(:user, :verified) }
  let(:requester) { create(:user, :verified) }
  let!(:dropoff) { create(:event, :dropoff, host: host, title: "Après-midi jeux") }
  let!(:accompanied) { create(:event, host: host, title: "Football au parc") }

  let(:create_params) do
    { title: "Après-midi jeux", category: "board_games", starts_at: 3.days.from_now.change(hour: 15).iso8601,
      ends_at: 3.days.from_now.change(hour: 18).iso8601, area: "paris-11", exact_address: "12 rue Oberkampf, 75011 Paris",
      places_total: 6, adult_required: false, age_min: 4, age_max: 8, host_phone: "06 12 34 56 78" }
  end

  before do
    create(:event_participation, event: dropoff, user: participant)
    create(:event_participation, :pending, event: dropoff, user: requester)
  end

  def create_event(publish: true, **attributes)
    post "/api/v1/events", params: { event: create_params.merge(attributes), publish: publish }, headers: auth_headers(host), as: :json
  end

  def search_titles(headers)
    get "/api/v1/events", params: { area: "paris-11" }, headers: headers
    json["events"].pluck("title")
  end

  def show_status(headers)
    get "/api/v1/events/#{dropoff.id}", headers: headers
    response.status
  end

  it "is off by default" do
    expect(Rails.configuration.x.events.dropoff_enabled).to be(false)
    expect(Event.dropoff_enabled?).to be(false)
  end

  context "when switched off", dropoff: false do
    it "creating a drop-off event is refused with dropoff_disabled, draft or published" do
      expect { create_event }.not_to change(Event, :count)
      expect(response).to have_http_status(:unprocessable_content)
      expect(error_code).to eq("dropoff_disabled")

      expect { create_event(publish: false) }.not_to change(Event, :count)
      expect(error_code).to eq("dropoff_disabled")
    end

    it "an event with an accompanying adult is still created" do
      create_event(adult_required: true, host_phone: nil)
      expect(response).to have_http_status(:created)
      expect(json["event"]).to include("adult_required" => true)
    end

    it "turning a draft into a drop-off event, or publishing a drop-off draft, is refused" do
      draft = create(:event, :draft, host: host)
      patch "/api/v1/events/#{draft.id}", params: { event: { adult_required: false } }, headers: auth_headers(host), as: :json
      expect(error_code).to eq("dropoff_disabled")
      expect(draft.reload.adult_required).to be(true)

      dropoff_draft = create(:event, :dropoff, :draft, host: host)
      post "/api/v1/events/#{dropoff_draft.id}/publish", headers: auth_headers(host)
      expect(response).to have_http_status(:unprocessable_content)
      expect(error_code).to eq("dropoff_disabled")
      expect(dropoff_draft.reload).to be_draft

      patch "/api/v1/events/#{dropoff_draft.id}", params: { event: { adult_required: true } }, headers: auth_headers(host), as: :json
      expect(response).to have_http_status(:ok)
      expect(json["event"]).to include("adult_required" => true)
    end

    it "the host can still edit their published drop-off event" do
      patch "/api/v1/events/#{dropoff.id}", params: { event: { title: "Jeux de société" } }, headers: auth_headers(host), as: :json
      expect(response).to have_http_status(:ok)
      expect(dropoff.reload.title).to eq("Jeux de société")
    end

    it "drop-off events are hidden from member and guest search" do
      expect(search_titles(auth_headers(member))).to eq([ "Football au parc" ])
      expect(search_titles(guest_headers)).to eq([ "Football au parc" ])
    end

    it "the detail is the neutral not-found for guests, members and pending requesters, and joining is refused" do
      expect(show_status(guest_headers)).to eq(404)
      expect(show_status(auth_headers(member))).to eq(404)
      expect(show_status(auth_headers(requester))).to eq(404)

      post "/api/v1/events/#{dropoff.id}/participation", params: { adults: 1, children: 1, responsibility_acknowledged: true },
                                                         headers: auth_headers(member), as: :json
      expect(response).to have_http_status(:not_found)
    end

    it "the host and accepted participants keep their event; pending requests stay as they are" do
      expect(show_status(auth_headers(host))).to eq(200)
      expect(show_status(auth_headers(participant))).to eq(200)
      expect(EventParticipation.find_by(user: requester, event: dropoff).status).to eq("pending")

      get "/api/v1/events/#{dropoff.id}/requests", headers: auth_headers(host)
      expect(response).to have_http_status(:ok)

      get "/api/v1/me/events", params: { role: "participant" }, headers: auth_headers(participant)
      expect(json["events"].pluck("id")).to eq([ dropoff.id ])
      get "/api/v1/me/events", params: { role: "participant" }, headers: auth_headers(requester)
      expect(json["events"]).to be_empty
      get "/api/v1/me/events", params: { role: "host" }, headers: auth_headers(host)
      expect(json["events"].pluck("id")).to include(dropoff.id)
    end

    it "circle outings and the My space agenda skip drop-off events of others, not the parent's own" do
      circle = create(:circle, created_by: host)
      create(:circle_membership, circle: circle, user: member)
      outing = create(:event, :dropoff, host: host, visibility: "circles", chosen_circle_ids: [ circle.id ], title: "Goûter du cercle")

      get "/api/v1/circles/#{circle.id}", headers: auth_headers(member)
      expect(json.dig("circle", "events")).to eq([])

      get "/api/v1/me/agenda", headers: auth_headers(member)
      expect(json["events"].pluck("id")).not_to include(outing.id)

      get "/api/v1/me/agenda", headers: auth_headers(participant)
      expect(json["events"].pluck("id")).to eq([ dropoff.id ])
      get "/api/v1/me/agenda", headers: auth_headers(host)
      expect(json["events"].pluck("id")).to include(dropoff.id, outing.id)
    end

    it "event options say drop-off is off" do
      get "/api/v1/event_options", headers: auth_headers(member)
      expect(json["dropoff_enabled"]).to be(false)
    end
  end

  context "when switched on", dropoff: true do
    it "creates a drop-off event as today" do
      create_event
      expect(response).to have_http_status(:created)
      expect(json["event"]).to include("adult_required" => false, "join_rule" => "verified_only")
    end

    it "lists drop-off events and shows them to members and pending requesters" do
      expect(search_titles(auth_headers(member))).to contain_exactly("Après-midi jeux", "Football au parc")
      expect(show_status(auth_headers(member))).to eq(200)
      expect(show_status(auth_headers(requester))).to eq(200)

      get "/api/v1/me/events", params: { role: "participant" }, headers: auth_headers(requester)
      expect(json["events"].pluck("id")).to eq([ dropoff.id ])
    end

    it "lists circle drop-off outings and says drop-off is on in the event options" do
      circle = create(:circle, created_by: host)
      create(:circle_membership, circle: circle, user: member)
      outing = create(:event, :dropoff, host: host, visibility: "circles", chosen_circle_ids: [ circle.id ])

      get "/api/v1/me/agenda", headers: auth_headers(member)
      expect(json["events"].pluck("id")).to include(outing.id)

      get "/api/v1/event_options", headers: auth_headers(member)
      expect(json["dropoff_enabled"]).to be(true)
    end
  end
end
