require "rails_helper"

# US-17: drop-off events and host approval (AC-17.1 to AC-17.25, AC-5.2).
RSpec.describe "Events: drop-off and host approval", type: :request do
  let(:host) { create(:user, :verified, first_name: "Camille", last_name: "Dupont") }
  let(:parent) { create(:user, :verified, first_name: "Sofia", last_name: "Rossi") }
  let(:other_parent) { create(:user, :verified, first_name: "Karim", last_name: "Benali") }
  let(:dropoff) { create(:event, :dropoff, host: host, places_total: 6) }
  let(:approval) { create(:event, :with_approval, host: host, places_total: 6) }

  let(:create_params) do
    { title: "Après-midi jeux", category: "board_games", starts_at: 3.days.from_now.change(hour: 15).iso8601,
      ends_at: 3.days.from_now.change(hour: 18).iso8601, area: "paris-11", exact_address: "12 rue Oberkampf, 75011 Paris",
      places_total: 10 }
  end

  def create_event(publish: true, **attributes)
    post "/api/v1/events", params: { event: create_params.merge(attributes), publish: publish }, headers: auth_headers(host), as: :json
  end

  def join(user, target, **body)
    post "/api/v1/events/#{target.id}/participation", params: { adults: 1, children: 1 }.merge(body),
                                                      headers: auth_headers(user), as: :json
  end

  def join_dropoff(user, target = dropoff, **body)
    join(user, target, responsibility_acknowledged: true, **body)
  end

  def show(target, headers) = (get("/api/v1/events/#{target.id}", headers: headers) && json["event"])
  def requests_of(target) = (get("/api/v1/events/#{target.id}/requests", headers: auth_headers(host)) && json)
  def row(user, target) = EventParticipation.find_by(user_id: user.id, event_id: target.id)

  def accept(target, user)
    post "/api/v1/events/#{target.id}/requests/#{row(user, target).id}/accept", headers: auth_headers(host)
  end

  def decline(target, user)
    post "/api/v1/events/#{target.id}/requests/#{row(user, target).id}/decline", headers: auth_headers(host)
  end

  describe "creating and publishing" do
    it "AC-17.1 the accompanying adult is required by default, approval automatic (AC-17.13)" do
      create_event
      expect(json["event"]).to include("adult_required" => true, "approval_required" => false)
    end

    it "AC-17.3, AC-17.8 a drop-off event is verified members only, whatever is sent, and approval is on by default" do
      create_event(adult_required: false, join_rule: "anyone", age_min: 3, age_max: 8, host_phone: "06 12 34 56 78")
      expect(response).to have_http_status(:created)
      expect(json["event"]).to include("adult_required" => false, "join_rule" => "verified_only", "approval_required" => true,
                                       "host_phone" => "+33612345678")
    end

    it "AC-17.8 the host may switch approval off when creating a drop-off event" do
      create_event(adult_required: false, approval_required: false, age_min: 3, age_max: 8, host_phone: "0612345678")
      expect(json["event"]).to include("approval_required" => false)
    end

    it "AC-17.4 a drop-off event needs the age range and the host's phone to be published" do
      create_event(adult_required: false)
      expect(response).to have_http_status(:unprocessable_content)
      expect(json.dig("error", "details")).to include("age_min" => [ "blank" ], "age_max" => [ "blank" ], "host_phone" => [ "blank" ])
    end

    it "AC-17.4 a draft drop-off event can be saved without them" do
      create_event(adult_required: false, publish: false)
      expect(response).to have_http_status(:created)
    end

    it "AC-17.11 refuses a phone number that is neither French nor EU" do
      create_event(adult_required: false, age_min: 3, age_max: 8, host_phone: "+1 415 555 0100")
      expect(json.dig("error", "details", "host_phone")).to eq([ "invalid" ])
    end

    it "AC-17.9 the host's phone is not kept on an event with an accompanying adult" do
      create_event(host_phone: "0612345678")
      expect(Event.last.host_phone).to be_nil
    end

    it "AC-17.1, AC-17.3, AC-17.13 both settings and the join rule can't change after publishing; the phone can" do
      patch "/api/v1/events/#{dropoff.id}", params: { event: { adult_required: true } }, headers: auth_headers(host), as: :json
      expect(json.dig("error", "details", "adult_required")).to eq([ "not_editable" ])
      patch "/api/v1/events/#{dropoff.id}", params: { event: { approval_required: false } }, headers: auth_headers(host), as: :json
      expect(json.dig("error", "details", "approval_required")).to eq([ "not_editable" ])
      patch "/api/v1/events/#{dropoff.id}", params: { event: { join_rule: "anyone" } }, headers: auth_headers(host), as: :json
      expect(dropoff.reload.join_rule).to eq("verified_only")
      patch "/api/v1/events/#{dropoff.id}", params: { event: { host_phone: "+49 30 1234567" } }, headers: auth_headers(host), as: :json
      expect(response).to have_http_status(:ok)
      expect(dropoff.reload.host_phone).to eq("+49301234567")
    end

    it "AC-17.12 the phone is encrypted at rest" do
      raw = Event.connection.select_value("SELECT host_phone FROM events WHERE id = #{Event.connection.quote(dropoff.id)}")
      expect(raw).not_to include("612345678")
    end
  end

  describe "joining a drop-off event (AC-17.2, AC-17.6, AC-17.7, AC-17.10)" do
    let(:dropoff) { create(:event, :dropoff, host: host, places_total: 6, approval_required: false) }

    it "AC-17.2 allows 0 adults with at least one child, and records the acknowledgement" do
      join_dropoff(parent, adults: 0, children: 2, emergency_phone: "06 98 76 54 32")
      expect(response).to have_http_status(:created)
      expect(row(parent, dropoff)).to have_attributes(adults: 0, children: 2, emergency_phone: "+33698765432")
      expect(row(parent, dropoff).responsibility_acknowledged_at).to be_present
      expect(dropoff.reload.places_taken).to eq(2)
    end

    it "AC-17.2 needs at least one child" do
      join_dropoff(parent, adults: 1, children: 0)
      expect(json.dig("error", "details", "children")).to eq([ "too_few" ])
    end

    it "AC-17.6 refuses without the ticked acknowledgement" do
      join(parent, dropoff, adults: 1, children: 1)
      expect(response).to have_http_status(:unprocessable_content)
      expect(json.dig("error", "details", "responsibility_acknowledged")).to eq([ "blank" ])
    end

    it "AC-17.7 needs an emergency phone with 0 adults; AC-17.10 it is optional with an adult" do
      join_dropoff(parent, adults: 0, children: 1)
      expect(json.dig("error", "details", "emergency_phone")).to eq([ "blank" ])
      join_dropoff(parent, adults: 1, children: 1)
      expect(response).to have_http_status(:created)
    end

    it "AC-17.11 refuses an invalid emergency phone" do
      join_dropoff(parent, adults: 0, children: 1, emergency_phone: "12345")
      expect(json.dig("error", "details", "emergency_phone")).to eq([ "invalid" ])
    end

    it "AC-17.3 refuses an unverified member, even through the API" do
      join_dropoff(create(:user), adults: 1, children: 1)
      expect(error_code).to eq("verification_required")
    end

    it "AC-5.2 a standard event still needs one adult" do
      join(parent, create(:event, host: host), adults: 0, children: 2)
      expect(json.dig("error", "details", "adults")).to eq([ "too_few" ])
    end
  end

  describe "requests (AC-17.14, AC-17.15)" do
    it "AC-17.14 a join is a pending request that holds no place; AC-17.15 places and full ignore it" do
      join_dropoff(parent, adults: 0, children: 3, emergency_phone: "0698765432")
      expect(response).to have_http_status(:created)
      event = json["event"]
      expect(event["places"]).to eq("total" => 6, "taken" => 0, "left" => 6)
      expect(event["viewer"]).to include("role" => "member", "joined" => false, "join_blocker" => "requested")
      expect(event["viewer"]["request"]).to include("status" => "pending", "places" => 3, "adults" => 0, "children" => 3)
      expect(Time.iso8601(event["viewer"]["request"]["expires_at"])).to be_within(1.second).of(48.hours.from_now)
      expect(event).not_to have_key("exact_address")
      expect(event).not_to have_key("host_phone")
    end

    it "AC-17.14 one pending request per event and parent" do
      join(parent, approval)
      join(parent, approval)
      expect(error_code).to eq("already_requested")
    end

    it "AC-17.14 can be withdrawn at any time, then sent again" do
      join(parent, approval)
      delete "/api/v1/events/#{approval.id}/participation", headers: auth_headers(parent)
      expect(response).to have_http_status(:no_content)
      expect(row(parent, approval).status).to eq("withdrawn")
      join(parent, approval)
      expect(row(parent, approval).status).to eq("pending")
    end

    it "AC-17.14 a request can't ask for more places than are left" do
      join(parent, approval, adults: 4, children: 3)
      expect(error_code).to eq("not_enough_places")
    end

    it "AC-17.15, AC-17.24 the pending count is for the host only; nobody else sees requests" do
      join(parent, approval)
      expect(show(approval, auth_headers(host))["pending_requests_count"]).to eq(1)
      member_view = show(approval, auth_headers(other_parent))
      expect(member_view).not_to have_key("pending_requests_count")
      expect(member_view["viewer"]["request"]).to be_nil
      get "/api/v1/events/#{approval.id}/requests", headers: auth_headers(other_parent)
      expect(response).to have_http_status(:not_found)
    end

    it "AC-17.24 guests see the drop-off notice flag and the locked rule, never request states or the host" do
      join_dropoff(parent)
      guest = show(dropoff, guest_headers)
      expect(guest).to include("adult_required" => false, "approval_required" => true, "join_rule" => "verified_only")
      expect(guest["viewer"]).to include("join_blocker" => "verification_required", "request" => nil)
      expect(guest).not_to have_key("host")
      expect(guest).not_to have_key("pending_requests_count")
    end

    it "lists the requests for the host, oldest first, without phone numbers" do
      join_dropoff(parent, adults: 0, children: 2, emergency_phone: "0698765432")
      travel 1.minute
      join_dropoff(other_parent)
      list = requests_of(dropoff)
      expect(list["places_left"]).to eq(6)
      expect(list["requests"].map { |item| item["first_name"] }).to eq(%w[Sofia Karim])
      expect(list["requests"].first).to include("last_name_initial" => "R", "verified" => true, "adults" => 0, "children" => 2,
                                                "places" => 2, "extra" => false)
      expect(response.body).not_to include("698765432", "612345678")
    end

    it "AC-17.21 more places for an accepted participant are a new request; fewer never need approval" do
      join(parent, approval, adults: 1, children: 1)
      accept(approval, parent)
      patch "/api/v1/events/#{approval.id}/participation", params: { adults: 1, children: 3 }, headers: auth_headers(parent), as: :json
      event = json["event"]
      expect(event["places"]["taken"]).to eq(2)
      expect(event["my_participation"]).to include("places" => 2, "pending_change" => include("places" => 4))
      expect(requests_of(approval)["requests"].first).to include("extra" => true, "places" => 2, "current_places" => 2)
      accept(approval, parent)
      expect(approval.reload.places_taken).to eq(4)
      patch "/api/v1/events/#{approval.id}/participation", params: { adults: 1, children: 0 }, headers: auth_headers(parent), as: :json
      expect(json["event"]["places"]["taken"]).to eq(1)
    end

    it "AC-17.21 a request for more places can be withdrawn, keeping the accepted ones" do
      join(parent, approval)
      accept(approval, parent)
      patch "/api/v1/events/#{approval.id}/participation", params: { adults: 2, children: 2 }, headers: auth_headers(parent), as: :json
      delete "/api/v1/events/#{approval.id}/participation/request", headers: auth_headers(parent)
      expect(json["event"]["my_participation"]).to include("places" => 2, "pending_change" => nil)
    end
  end

  describe "the host decides (AC-17.16, AC-17.17)" do
    before { join_dropoff(parent, adults: 0, children: 2, emergency_phone: "0698765432") }

    it "AC-17.16 accept takes the places; the parent gets the address and the host's phone (AC-17.9)" do
      accept(dropoff, parent)
      expect(response).to have_http_status(:ok)
      expect(json["event"]["places"]["taken"]).to eq(2)
      expect(json["event"]["pending_requests_count"]).to eq(0)
      parent_view = show(dropoff, auth_headers(parent))
      expect(parent_view).to include("exact_address" => dropoff.exact_address, "host_phone" => "+33612345678")
      expect(parent_view["viewer"]).to include("role" => "participant", "joined" => true)
    end

    it "AC-17.10 the host sees the emergency phone only after accepting" do
      expect(show(dropoff, auth_headers(host))["participants"]).to be_empty
      accept(dropoff, parent)
      expect(show(dropoff, auth_headers(host))["participants"].first).to include("emergency_phone" => "+33698765432")
      expect(show(dropoff, auth_headers(parent))["participants"].first).not_to have_key("emergency_phone")
    end

    it "AC-17.16 decline: neutral, the emergency phone is erased, and the parent can't ask again" do
      decline(dropoff, parent)
      expect(response).to have_http_status(:ok)
      expect(row(parent, dropoff)).to have_attributes(status: "declined", emergency_phone: nil)
      view = show(dropoff, auth_headers(parent))
      expect(view["viewer"]).to include("join_blocker" => "declined", "can_join" => false)
      expect(view["viewer"]["request"]).to include("status" => "declined", "closed_reason" => nil)
      join_dropoff(parent)
      expect(error_code).to eq("request_declined")
    end

    it "one decision per request" do
      decline(dropoff, parent)
      accept(dropoff, parent)
      expect(error_code).to eq("request_not_pending")
    end

    it "AC-17.17 refuses an accept that doesn't fit, then accepts once places are raised" do
      dropoff.update_columns(places_taken: 5)
      accept(dropoff, parent)
      expect(response).to have_http_status(:conflict)
      expect(json["error"]).to include("code" => "not_enough_places", "places_left" => 1)
      patch "/api/v1/events/#{dropoff.id}", params: { event: { places_total: 8 } }, headers: auth_headers(host), as: :json
      accept(dropoff, parent)
      expect(response).to have_http_status(:ok)
    end

    it "only the host can decide" do
      post "/api/v1/events/#{dropoff.id}/requests/#{row(parent, dropoff).id}/accept", headers: auth_headers(other_parent)
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "AC-17.18 full closes the requests still waiting" do
    it "closes them with the neutral 'Event full' email" do
      join(parent, approval, adults: 2, children: 4)
      join(other_parent, approval, adults: 1, children: 0)
      expect { accept(approval, parent) }.to have_enqueued_mail(EventMailer, :request_closed_full)
      expect(row(other_parent, approval)).to have_attributes(status: "closed", closed_reason: "full")
      expect(show(approval, auth_headers(other_parent))["viewer"]["request"]).to include("status" => "closed", "closed_reason" => "full")
    end

    it "also when the host lowers the places to what is taken" do
      join(parent, approval)
      accept(approval, parent)
      join(other_parent, approval)
      patch "/api/v1/events/#{approval.id}", params: { event: { places_total: 2 } }, headers: auth_headers(host), as: :json
      expect(row(other_parent, approval).status).to eq("closed")
    end
  end

  describe "AC-17.19 expiry" do
    before { join(parent, approval) }

    it "expires 48 hours after the request, and the parent can ask again" do
      travel 47.hours
      ExpireEventRequestsJob.perform_now
      expect(row(parent, approval).status).to eq("pending")
      travel 2.hours
      expect { ExpireEventRequestsJob.perform_now }.to have_enqueued_mail(EventMailer, :request_expired)
      expect(row(parent, approval).status).to eq("expired")
      join(parent, approval)
      expect(row(parent, approval).status).to eq("pending")
    end

    it "expires at the event start when that comes first" do
      approval.update_columns(starts_at: 2.hours.from_now, ends_at: 4.hours.from_now)
      travel 2.hours + 1.minute
      ExpireEventRequestsJob.perform_now
      expect(row(parent, approval).status).to eq("expired")
    end

    it "an overdue request can't be accepted even before the job runs" do
      travel 49.hours
      accept(approval, parent)
      expect(error_code).to eq("request_expired")
      expect(row(parent, approval).status).to eq("expired")
    end
  end

  describe "AC-17.20 accept all" do
    it "accepts in order of arrival and stops when places run out; the rest are closed as full" do
      third = create(:user, :verified)
      join(parent, approval, adults: 1, children: 2)
      travel 1.minute
      join(other_parent, approval, adults: 1, children: 2)
      travel 1.minute
      join(third, approval, adults: 1, children: 0)
      approval.update_columns(places_taken: 1)
      post "/api/v1/events/#{approval.id}/requests/accept_all", headers: auth_headers(host)
      expect(json).to include("accepted" => 1, "closed" => 0)
      expect(row(parent, approval).status).to eq("accepted")
      expect(row(other_parent, approval).status).to eq("pending")
      approval.update_columns(places_taken: 3)
      post "/api/v1/events/#{approval.id}/requests/accept_all", headers: auth_headers(host)
      expect(json).to include("accepted" => 1, "closed" => 1)
      expect(row(third, approval)).to have_attributes(status: "closed", closed_reason: "full")
    end
  end

  describe "AC-17.22 lost verification" do
    before { join_dropoff(parent) }

    it "closes the request silently and it can't be accepted" do
      expect { parent.update!(verification_status: "not_verified", verification_expires_on: nil) }
        .not_to have_enqueued_mail(EventMailer)
      expect(row(parent, dropoff)).to have_attributes(status: "closed", closed_reason: "verification")
    end

    it "an expiry not yet written by the daily job is caught at accept" do
      parent.update_columns(verification_expires_on: Date.current)
      accept(dropoff, parent)
      expect(error_code).to eq("request_closed")
      expect(row(parent, dropoff).closed_reason).to eq("verification")
    end
  end

  describe "AC-17.23 suspension and cancellation" do
    before { join(parent, approval) }

    it "a suspended event freezes the requests" do
      approval.suspend!("admin")
      accept(approval, parent)
      expect(error_code).to eq("requests_frozen")
      expect(requests_of(approval)["frozen"]).to be(true)
      approval.resume!
      accept(approval, parent)
      expect(response).to have_http_status(:ok)
    end

    it "cancelling closes them and the requesters get the neutral cancellation email" do
      expect { post "/api/v1/events/#{approval.id}/cancel", headers: auth_headers(host) }
        .to have_enqueued_mail(EventMailer, :event_cancelled).with(approval, parent, neutral: true)
      expect(row(parent, approval)).to have_attributes(status: "closed", closed_reason: "cancelled")
    end
  end

  describe "AC-17.9, AC-17.12 phone visibility and retention" do
    let(:dropoff) { create(:event, :dropoff, host: host, places_total: 6, approval_required: false) }

    before { join_dropoff(parent, adults: 0, children: 1, emergency_phone: "0698765432") }

    it "the host's phone: never to members, guests or pending requesters" do
      expect(show(dropoff, auth_headers(other_parent))).not_to have_key("host_phone")
      expect(show(dropoff, guest_headers)).not_to have_key("host_phone")
      expect(show(dropoff, auth_headers(parent))["host_phone"]).to eq("+33612345678")
    end

    it "the host's phone stops being shown 24 hours after the end, and on cancellation" do
      travel_to(dropoff.ends_at + 23.hours)
      expect(show(dropoff, auth_headers(parent))["host_phone"]).to eq("+33612345678")
      travel_to(dropoff.ends_at + 25.hours)
      view = show(dropoff, auth_headers(parent))
      expect(view).not_to have_key("host_phone")
      expect(view["phone_visible_until"]).to be_present
      expect(show(dropoff, auth_headers(host))["host_phone"]).to eq("+33612345678")
    end

    it "the emergency phone is erased 24 hours after the end" do
      travel_to(dropoff.ends_at + 23.hours)
      EventStatusJob.perform_now
      expect(row(parent, dropoff).emergency_phone).to be_present
      travel_to(dropoff.ends_at + 25.hours)
      EventStatusJob.perform_now
      expect(row(parent, dropoff).emergency_phone).to be_nil
    end

    it "the emergency phone is erased at once on cancellation" do
      post "/api/v1/events/#{dropoff.id}/cancel", headers: auth_headers(host)
      expect(row(parent, dropoff).emergency_phone).to be_nil
      expect(show(dropoff, auth_headers(parent))).not_to have_key("host_phone")
    end

    it "leaving deletes the participation with its phone" do
      delete "/api/v1/events/#{dropoff.id}/participation", headers: auth_headers(parent)
      expect(row(parent, dropoff)).to be_nil
    end

    it "phones are filtered from the logs" do
      filter = ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters)
      expect(filter.filter("host_phone" => "0612345678", "emergency_phone" => "0698765432"))
        .to eq("host_phone" => "[FILTERED]", "emergency_phone" => "[FILTERED]")
    end

    it "the data copy holds each user's own phone (accounts AC-12.1)" do
      expect(Accounts::DataExportBuilder.new(host).as_json[:hosted_events].first).to include(host_phone: "+33612345678")
      expect(Accounts::DataExportBuilder.new(parent).as_json[:event_participations].first)
        .to include(emergency_phone: "+33698765432", status: "accepted")
    end

    it "erasure removes both (accounts AC-11.4)" do
      Accounts::Eraser.new(parent).erase!
      expect(EventParticipation.where(event_id: dropoff.id)).to be_empty
      Accounts::Eraser.new(host).erase!
      expect(Event.where(id: dropoff.id)).to be_empty
    end
  end

  describe "AC-7.1 my events" do
    it "lists a pending request with the joined events" do
      join(parent, approval)
      get "/api/v1/me/events", params: { role: "participant" }, headers: auth_headers(parent)
      expect(json["events"].map { |event| event["id"] }).to eq([ approval.id ])
      expect(json["events"].first["viewer"]["request"]).to include("status" => "pending")
    end
  end

  # Real concurrent accepts: each thread has its own database connection, so the
  # transactional test wrapper is turned off here and the rows are removed afterwards.
  describe "AC-17.17 two accepts at the same time" do
    self.use_transactional_tests = false

    let!(:race_host) { create(:user, :verified) }
    let!(:race_event) { create(:event, :with_approval, host: race_host, places_total: 3) }
    let!(:parents) { create_list(:user, 3, :verified) }

    after do
      Event.where(id: race_event.id).delete_all
      PendingEventNotification.where(event_id: race_event.id).delete_all
      User.where(id: parents.map(&:id) + [ race_host.id ]).destroy_all
    end

    it "never takes more places than the total" do
      ids = parents.map do |user|
        race_event.all_participations.create!(user: user, adults: 1, children: 1, status: "pending", requested_at: Time.current).id
      end
      header = auth_headers(race_host)
      ActiveRecord::Base.connection_pool.release_connection
      start = Concurrent::CountDownLatch.new(1)
      threads = ids.map do |id|
        Thread.new do
          session = ActionDispatch::Integration::Session.new(Rails.application)
          start.wait
          session.post "/api/v1/events/#{race_event.id}/requests/#{id}/accept", headers: header
          session.response.status
        end
      end
      start.count_down
      statuses = threads.map(&:value)

      expect(statuses.count(200)).to eq(1)
      expect(statuses.count(409)).to eq(2)
      expect(race_event.reload.places_taken).to eq(2)
      expect(EventParticipation.where(event_id: race_event.id, status: "accepted").sum(:places)).to eq(2)
    end
  end
end
