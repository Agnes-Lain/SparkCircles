require "rails_helper"

RSpec.describe "Circle-only events (circles US-16)", type: :request do
  let(:host) { create(:user, :verified) }
  let(:circle) { create(:circle, name: "Parents CE2", created_by: host) }
  let(:other_circle) { create(:circle, name: "Voisins") }
  let(:member) { create(:circle_membership, circle: circle, user: create(:user)).user }
  let(:event_params) do
    { title: "Goûter au parc", category: "playdates", starts_at: 3.days.from_now.change(hour: 15).iso8601,
      ends_at: 3.days.from_now.change(hour: 17).iso8601, area: "paris-11", exact_address: "1 rue X", places_total: 10,
      join_rule: "anyone", visibility: "circles", circle_ids: [ circle.id ] }
  end

  def circle_event(**attributes)
    create(:event, host: host, visibility: "circles", chosen_circle_ids: [ circle.id ], **attributes)
  end

  describe "creating" do
    it "AC-16.1 publishes an event visible to my circles with the fixed join rule" do
      post "/api/v1/events", params: { event: event_params, publish: true }, headers: auth_headers(host), as: :json
      expect(response).to have_http_status(:created)
      expect(json["event"]).to include("visibility" => "circles", "join_rule" => "anyone")
      expect(json.dig("event", "circles")).to eq([ { "id" => circle.id, "name" => "Parents CE2" } ])
    end

    it "AC-16.1 refuses a circle I'm not in, and a circle-visible event without a circle" do
      post "/api/v1/events", params: { event: event_params.merge(circle_ids: [ other_circle.id ]), publish: true },
                             headers: auth_headers(host), as: :json
      expect(json.dig("error", "details", "circle_ids")).to eq([ "inclusion" ])
      post "/api/v1/events", params: { event: event_params.merge(circle_ids: []), publish: true }, headers: auth_headers(host), as: :json
      expect(json.dig("error", "details", "circle_ids")).to eq([ "blank" ])
    end

    it "AC-16.2 refuses circles with searchable visibility and a verified-only rule on a circle event" do
      post "/api/v1/events", params: { event: event_params.merge(visibility: "searchable"), publish: true }, headers: auth_headers(host), as: :json
      expect(json.dig("error", "details", "circle_ids")).to eq([ "not_allowed" ])
      post "/api/v1/events", params: { event: event_params.merge(join_rule: "verified_only"), publish: true }, headers: auth_headers(host), as: :json
      expect(json.dig("error", "details", "join_rule")).to eq([ "inclusion" ])
    end

    it "AC-16.9 can't change visibility or circles after publishing" do
      event = circle_event
      create(:circle_membership, circle: other_circle, user: host)
      patch "/api/v1/events/#{event.id}", params: { event: { circle_ids: [ circle.id, other_circle.id ] } }, headers: auth_headers(host), as: :json
      expect(json.dig("error", "details", "circle_ids")).to eq([ "not_editable" ])
      patch "/api/v1/events/#{event.id}", params: { event: { visibility: "searchable" } }, headers: auth_headers(host), as: :json
      expect(json.dig("error", "details", "visibility")).to eq([ "not_editable" ])
    end
  end

  describe "visibility" do
    it "AC-16.3 only the host and members of the chosen circles see it, in search and by link" do
      event = circle_event
      outsider = create(:circle_membership, circle: other_circle, user: create(:user)).user
      get "/api/v1/events", params: { area: "paris" }, headers: auth_headers(member)
      expect(json["events"].map { |e| e["id"] }).to eq([ event.id ])
      expect(json["events"].first["circles"]).to eq([ { "id" => circle.id, "name" => "Parents CE2" } ])

      [ auth_headers(outsider), auth_headers(other_circle.created_by) ].each do |headers|
        get "/api/v1/events", params: { area: "paris" }, headers: headers
        expect(json["events"]).to eq([])
        get "/api/v1/events/#{event.id}", headers: headers
        expect(response).to have_http_status(:not_found)
      end
      get "/api/v1/events", params: { area: "paris" }, headers: guest_headers
      expect(json["events"]).to eq([])
      get "/api/v1/events/#{event.id}", headers: guest_headers
      expect(response).to have_http_status(:not_found)
    end

    it "AC-16.4 a member sees the circle name and host badge, not the address before joining" do
      event = circle_event
      get "/api/v1/events/#{event.id}", headers: auth_headers(member)
      expect(json["event"]).to include("circles" => [ { "id" => circle.id, "name" => "Parents CE2" } ])
      expect(json.dig("event", "host", "verified")).to be(true)
      expect(json["event"]).not_to have_key("exact_address")
    end

    it "AC-16.10 an unverified member may join" do
      event = circle_event
      post "/api/v1/events/#{event.id}/participation", params: { adults: 1, children: 1 }, headers: auth_headers(member), as: :json
      expect(response).to have_http_status(:created)
    end

    it "AC-17.12 a public circle never makes its events public" do
      event = circle_event
      expect(circle).to be_public
      post "/api/v1/events/#{event.id}/participation", params: { adults: 1, children: 1 }, headers: auth_headers(create(:user)), as: :json
      expect(response).to have_http_status(:not_found)
    end

    it "AC-16.5 a paused circle hides its events from members who haven't joined" do
      event = circle_event
      circle.update!(status: "suspended")
      get "/api/v1/events/#{event.id}", headers: auth_headers(member)
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "leaving and removal" do
    let!(:event) { circle_event }

    before do
      post "/api/v1/events/#{event.id}/participation", params: { adults: 1, children: 1 }, headers: auth_headers(member), as: :json
    end

    it "AC-16.5 a member who leaves is removed from the joined event and e-mailed; the place is freed" do
      expect { delete "/api/v1/circles/#{circle.id}/membership", headers: auth_headers(member) }
        .to have_enqueued_mail(CircleMailer, :event_access_lost)
      expect(event.reload.places_taken).to eq(0)
      get "/api/v1/events/#{event.id}", headers: auth_headers(member)
      expect(response).to have_http_status(:not_found)
    end

    it "AC-16.5 a removed member too" do
      row = circle.memberships.find_by(user: member)
      expect { delete "/api/v1/circles/#{circle.id}/members/#{row.id}", headers: auth_headers(host) }
        .to have_enqueued_mail(CircleMailer, :event_access_lost).with(event, member, :removed)
      expect(event.reload.places_taken).to eq(0)
    end

    it "AC-16.6 keeps the booking of a member who stays in another chosen circle" do
      create(:circle_membership, circle: other_circle, user: host)
      create(:circle_membership, circle: other_circle, user: member)
      event.event_circles.create!(circle: other_circle)
      delete "/api/v1/circles/#{circle.id}/membership", headers: auth_headers(member)
      expect(event.reload.places_taken).to eq(2)
    end

    it "AC-16.7 a host who leaves every chosen circle sees the event cancelled" do
      co = create(:circle_membership, circle: circle, role: "admin", admin_since: Time.current)
      expect(co).to be_admin
      delete "/api/v1/circles/#{circle.id}/membership", headers: auth_headers(host)
      expect(event.reload).to be_cancelled
    end
  end

  it "AC-16.8 a host without circles keeps searchable events only" do
    lonely = create(:user, :verified)
    post "/api/v1/events", params: { event: event_params.merge(circle_ids: [ circle.id ]), publish: true }, headers: auth_headers(lonely), as: :json
    expect(json.dig("error", "details", "circle_ids")).to eq([ "inclusion" ])
  end
end
