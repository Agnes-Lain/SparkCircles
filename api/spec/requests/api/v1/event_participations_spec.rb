require "rails_helper"

RSpec.describe "Events: join and leave", type: :request do
  let(:host) { create(:user, :verified) }
  let(:event) { create(:event, host: host, places_total: 5) }
  let(:parent) { create(:user) }
  let(:path) { "/api/v1/events/#{event.id}/participation" }

  def join(user, adults: 1, children: 0, target: event)
    post "/api/v1/events/#{target.id}/participation", params: { adults: adults, children: children },
                                                       headers: auth_headers(user), as: :json
  end

  describe "POST participation" do
    it "AC-5.1, AC-5.5 confirms at once without verification on an 'anyone' event and returns the address (AC-6.2)" do
      join(parent, adults: 1, children: 2)
      expect(response).to have_http_status(:created)
      expect(json["event"]).to include("exact_address" => event.exact_address,
                                       "my_participation" => { "adults" => 1, "children" => 2, "places" => 3 })
      expect(json["event"]["places"]).to eq("total" => 5, "taken" => 3, "left" => 2)
    end

    it "AC-5.2 needs at least one adult" do
      join(parent, adults: 0, children: 2)
      expect(response).to have_http_status(:unprocessable_content)
      expect(json.dig("error", "details", "adults")).to eq([ "too_few" ])
      expect(event.reload.places_taken).to eq(0)
    end

    it "AC-5.3 refuses more places than are left and says how many remain" do
      join(parent, adults: 2, children: 4)
      expect(response).to have_http_status(:conflict)
      expect(json["error"]).to include("code" => "not_enough_places", "places_left" => 5, "message" => "Il ne reste que 5 places.")
    end

    it "AC-5.3 says the event is full when no place is left" do
      event.update_columns(places_taken: 5)
      join(parent)
      expect(json["error"]).to include("code" => "not_enough_places", "places_left" => 0, "message" => "Cette sortie est complète.")
    end

    it "AC-2.4 refuses an unverified member on a 'verified members only' event, even through the API" do
      locked = create(:event, :verified_only, host: host)
      join(parent, target: locked)
      expect(response).to have_http_status(:forbidden)
      expect(error_code).to eq("verification_required")
      join(create(:user, :verified), target: locked)
      expect(response).to have_http_status(:created)
    end

    it "AC-5.6 refuses the host" do
      join(host)
      expect(error_code).to eq("own_event")
    end

    it "AC-5.7 refuses joining twice" do
      join(parent)
      join(parent)
      expect(error_code).to eq("already_joined")
    end

    it "AC-5.8 refuses a past, cancelled or suspended event" do
      ended = create(:event, :ended, host: host)
      join(parent, target: ended)
      expect(response).to have_http_status(:not_found)
      event.suspend!("admin")
      join(parent)
      expect(response).to have_http_status(:not_found)
    end

    it "refuses a guest" do
      post path, params: { adults: 1 }, headers: guest_headers, as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "PATCH participation" do
    before { join(parent, adults: 1, children: 1) }

    it "AC-5.2 changes the places within what is left" do
      patch path, params: { adults: 2, children: 3 }, headers: auth_headers(parent), as: :json
      expect(response).to have_http_status(:ok)
      expect(event.reload.places_taken).to eq(5)
      patch path, params: { adults: 2, children: 4 }, headers: auth_headers(parent), as: :json
      expect(error_code).to eq("not_enough_places")
      expect(event.reload.places_taken).to eq(5)
    end
  end

  describe "DELETE participation" do
    before { join(parent, adults: 1, children: 1) }

    it "AC-5.4 frees the places at once" do
      delete path, headers: auth_headers(parent)
      expect(response).to have_http_status(:no_content)
      expect(event.reload.places_taken).to eq(0)
    end

    it "AC-5.4 refuses leaving after the start" do
      event.update_columns(starts_at: 1.minute.ago)
      delete path, headers: auth_headers(parent)
      expect(error_code).to eq("event_started")
    end

    it "answers not_joined for someone who isn't in" do
      delete path, headers: auth_headers(create(:user))
      expect(error_code).to eq("not_joined")
    end
  end

  # Real concurrent requests: each thread has its own database connection, so the
  # transactional test wrapper is turned off here and the rows are removed afterwards.
  describe "AC-5.8 two parents asking for the last places at the same time" do
    self.use_transactional_tests = false

    let!(:race_host) { create(:user, :verified) }
    let!(:race_event) { create(:event, host: race_host, places_total: 3) }
    let!(:parents) { create_list(:user, 4) }

    after do
      Event.where(id: race_event.id).delete_all
      User.where(id: parents.map(&:id) + [ race_host.id ]).destroy_all
    end

    it "never takes more places than the total" do
      headers = parents.map { |user| auth_headers(user) }
      ActiveRecord::Base.connection_pool.release_connection
      start = Concurrent::CountDownLatch.new(1)
      threads = headers.map do |header|
        Thread.new do
          session = ActionDispatch::Integration::Session.new(Rails.application)
          start.wait
          session.post "/api/v1/events/#{race_event.id}/participation", params: { adults: 1, children: 1 },
                                                                        headers: header, as: :json
          session.response.status
        end
      end
      start.count_down
      statuses = threads.map(&:value)

      expect(statuses.count(201)).to eq(1)
      expect(statuses.count(409)).to eq(3)
      race_event.reload
      expect(race_event.places_taken).to eq(2)
      expect(EventParticipation.where(event_id: race_event.id).sum(:places)).to eq(2)
    end
  end
end
