require "rails_helper"

# Spec events, US-15 table: each audience gets exactly its fields, whatever the request.
RSpec.describe "Events: what each audience sees", type: :request do
  let(:host) { create(:user, :verified, first_name: "Claire", last_name: "Martin") }
  let!(:event) { create(:event, host: host) }
  let!(:verified_only) { create(:event, :verified_only, host: host, title: "Jeux de société") }
  let(:member) { create(:user) }
  let(:verified_member) { create(:user, :verified) }
  let(:participant) { create(:user, first_name: "Thomas", last_name: "Renard") }

  COMMON_KEYS = %w[id kind status title description category language tags starts_at ends_at time_zone area distance_km
                   age_min age_max join_rule places full adult_required approval_required viewer].freeze

  def get_event(target, headers)
    get "/api/v1/events/#{target.id}", headers: headers
    expect(response).to have_http_status(:ok)
    json["event"]
  end

  def search(headers)
    get "/api/v1/events", params: { area: "paris-11" }, headers: headers
    expect(response).to have_http_status(:ok)
    json["events"]
  end

  def leaked_text = [ "Claire", "Martin", host.id, "Oberkampf", "Thomas", "Renard" ]

  describe "guest (no token)" do
    it "AC-15.2 gets the common fields and only a verified badge for an 'anyone' event" do
      data = get_event(event, guest_headers)
      expect(data.keys).to match_array(COMMON_KEYS + %w[host])
      expect(data["host"]).to eq("verified" => true)
      expect(data["description"]).to eq(event.description)
      expect(data["viewer"]).to include("role" => "guest", "can_join" => false, "join_blocker" => "account_required")
    end

    it "AC-15.2, AC-15.4 gets no host information at all on a 'verified members only' event" do
      data = get_event(verified_only, guest_headers)
      expect(data.keys).to match_array(COMMON_KEYS)
      expect(data["viewer"]["join_blocker"]).to eq("verification_required")
    end

    it "AC-15.11 never gets a host name, initial, id, participants or the exact address, in search or detail" do
      create(:event_participation, event: event, user: participant)
      bodies = []
      get "/api/v1/events", params: { area: "paris-11" }, headers: guest_headers
      bodies << response.body
      get "/api/v1/events/#{event.id}", headers: guest_headers
      bodies << response.body
      get "/api/v1/events/#{event.id}", params: { include: "host,participants", fields: "exact_address" }, headers: guest_headers
      bodies << response.body
      bodies.each { |body| leaked_text.each { |text| expect(body).not_to include(text) } }
      expect(bodies.join).not_to include("last_name_initial", "participants", "exact_address", "first_name")
    end

    it "AC-15.2 sees verified-only events in search, marked as such (AC-15.4)" do
      titles = search(guest_headers).map { |item| [ item["title"], item["join_rule"], item.key?("host") ] }
      expect(titles).to contain_exactly([ event.title, "anyone", true ], [ "Jeux de société", "verified_only", false ])
    end

    it "AC-15.2 never sees drafts, suspended or cancelled events" do
      hidden = [ create(:event, :draft, host: host), create(:event, :suspended, host: host), create(:event, :cancelled, host: host) ]
      expect(search(guest_headers).map { |item| item["id"] }).not_to include(*hidden.map(&:id))
      hidden.each do |target|
        get "/api/v1/events/#{target.id}", headers: guest_headers
        expect(response).to have_http_status(:not_found)
      end
    end
  end

  describe "member not verified" do
    it "AC-6.5 sees the host's first name and initial with the badge, no address, no participants (AC-6.1, AC-6.4)" do
      create(:event_participation, event: event, user: participant)
      data = get_event(event, auth_headers(member))
      # Circles US-16: members also get the visibility and their circles (none here).
      expect(data.keys).to match_array(COMMON_KEYS + %w[host visibility circles])
      expect(data).to include("visibility" => "searchable", "circles" => [])
      expect(data["host"]).to eq("id" => host.id, "first_name" => "Claire", "last_name_initial" => "M", "photo_url" => nil,
                                 "verified" => true, "former_member" => false)
      expect(response.body).not_to include("Oberkampf", "Thomas")
      expect(data["places"]).to eq("total" => 10, "taken" => 2, "left" => 8)
    end

    it "AC-2.4, AC-15 table sees a verified-only event locked: 'Verify to join'" do
      data = get_event(verified_only, auth_headers(member))
      expect(data["host"]["first_name"]).to eq("Claire")
      expect(data["viewer"]).to include("role" => "member", "can_join" => false, "join_blocker" => "verification_required")
    end
  end

  describe "verified member" do
    it "AC-15 table can join a verified-only event" do
      data = get_event(verified_only, auth_headers(verified_member))
      expect(data["viewer"]).to include("can_join" => true, "join_blocker" => nil)
      expect(data).not_to have_key("exact_address")
    end
  end

  describe "participant and host" do
    before { create(:event_participation, event: event, user: participant, adults: 1, children: 2) }

    it "AC-6.2, AC-6.4 a participant sees the exact address and the participant list, nothing more per person" do
      data = get_event(event, auth_headers(participant))
      expect(data["exact_address"]).to eq("12 rue Oberkampf, 75011 Paris")
      expect(data["participants"]).to eq([ { "first_name" => "Thomas", "last_name_initial" => "R", "verified" => false,
                                             "former_member" => false, "adults" => 1, "children" => 2 } ])
      expect(data["my_participation"]).to eq("adults" => 1, "children" => 2, "places" => 3, "emergency_phone" => nil, "pending_change" => nil)
      expect(data["viewer"]).to include("role" => "participant", "joined" => true, "join_blocker" => "joined")
      expect(data).to include("visibility" => "searchable", "circles" => [])
    end

    it "AC-6.2 the host sees the address, participants and publication fields" do
      data = get_event(event, auth_headers(host))
      expect(data).to include("exact_address" => "12 rue Oberkampf, 75011 Paris", "visibility" => "searchable",
                              "my_participation" => nil)
      expect(data["viewer"]).to include("role" => "host", "join_blocker" => "host")
    end

    it "AC-6.3 a participant loses the address when the event is cancelled; the host keeps it" do
      event.cancel!
      expect(get_event(event, auth_headers(participant))).not_to have_key("exact_address")
      expect(get_event(event, auth_headers(host))["exact_address"]).to be_present
    end

    it "AC-6.3 a participant who leaves no longer gets the address" do
      delete "/api/v1/events/#{event.id}/participation", headers: auth_headers(participant)
      expect(response).to have_http_status(:no_content)
      expect(get_event(event, auth_headers(participant))).not_to have_key("exact_address")
    end
  end

  describe "AC-1.4 drafts" do
    let!(:draft) { create(:event, :draft, host: host) }

    it "are visible only to their host" do
      get "/api/v1/events/#{draft.id}", headers: auth_headers(verified_member)
      expect(response).to have_http_status(:not_found)
      get "/api/v1/events", params: { area: "paris-11" }, headers: auth_headers(verified_member)
      expect(json["events"].map { |item| item["id"] }).not_to include(draft.id)
      expect(get_event(draft, auth_headers(host))["status"]).to eq("draft")
    end
  end

  it "answers 401 for an invalid token on a read endpoint instead of the guest view" do
    get "/api/v1/events/#{event.id}", headers: { "Authorization" => "Bearer nope" }
    expect(response).to have_http_status(:unauthorized)
  end
end
