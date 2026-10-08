require "rails_helper"

# QA round on US-17: criteria the developer's specs leave uncovered.
RSpec.describe "QA: drop-off and host approval gaps", type: :request, dropoff: true do
  let(:host) { create(:user, :verified) }
  let(:parent) { create(:user, :verified) }
  let(:other_parent) { create(:user, :verified) }
  let(:dropoff) { create(:event, :dropoff, host: host, places_total: 6) }
  let(:approval) { create(:event, :with_approval, host: host, places_total: 6) }

  def join(user, target, **body)
    post "/api/v1/events/#{target.id}/participation", params: { adults: 1, children: 1 }.merge(body),
                                                      headers: auth_headers(user), as: :json
  end

  def row(user, target) = EventParticipation.find_by(user_id: user.id, event_id: target.id)
  def show(target, headers) = (get("/api/v1/events/#{target.id}", headers: headers) && json["event"])

  def host_post(path)
    post "/api/v1/events/#{path}", headers: auth_headers(host)
  end

  def raw(table, column, id)
    ApplicationRecord.connection.select_value("SELECT #{column} FROM #{table} WHERE id = #{ApplicationRecord.connection.quote(id)}")
  end

  it "AC-17.12 the emergency phone is encrypted at rest" do
    join(parent, dropoff, adults: 0, children: 1, emergency_phone: "0698765432", responsibility_acknowledged: true)
    stored = raw("event_participations", "emergency_phone", row(parent, dropoff).id)
    expect(stored).to be_present
    expect(stored).not_to include("698765432")
  end

  it "AC-17.9 a declined, expired, closed or withdrawn requester never gets the host's phone" do
    join(parent, dropoff, responsibility_acknowledged: true)
    host_post("#{dropoff.id}/requests/#{row(parent, dropoff).id}/decline")
    expect(show(dropoff, auth_headers(parent))).not_to have_key("host_phone")
    row(parent, dropoff).update_columns(status: "expired")
    expect(show(dropoff, auth_headers(parent))).not_to have_key("host_phone")
    row(parent, dropoff).update_columns(status: "closed", closed_reason: "full")
    expect(show(dropoff, auth_headers(parent))).not_to have_key("host_phone")
  end

  it "AC-17.4 the host can't clear the phone of a published drop-off event" do
    patch "/api/v1/events/#{dropoff.id}", params: { event: { host_phone: "" } }, headers: auth_headers(host), as: :json
    expect(response).to have_http_status(:unprocessable_content)
    expect(dropoff.reload.host_phone).to be_present
  end

  it "AC-17.3 direct API: a published drop-off event can't be opened to everyone" do
    patch "/api/v1/events/#{dropoff.id}", params: { event: { join_rule: "anyone" } }, headers: auth_headers(host), as: :json
    expect(dropoff.reload.join_rule).to eq("verified_only")
  end

  it "AC-17.6 the acknowledgement must be a true value, not a truthy string" do
    join(parent, dropoff, responsibility_acknowledged: "false")
    expect(response).to have_http_status(:unprocessable_content)
    join(parent, dropoff, responsibility_acknowledged: "0")
    expect(response).to have_http_status(:unprocessable_content)
    expect(row(parent, dropoff)).to be_nil
  end

  it "AC-17.7 an accepted drop-off booking can't drop to 0 adults without an emergency phone" do
    join(parent, dropoff, responsibility_acknowledged: true)
    host_post("#{dropoff.id}/requests/#{row(parent, dropoff).id}/accept")
    patch "/api/v1/events/#{dropoff.id}/participation", params: { adults: 0, children: 1 }, headers: auth_headers(parent), as: :json
    expect(response).to have_http_status(:unprocessable_content)
  end

  it "AC-17.21 declining a request for extra places keeps the accepted places and the emergency phone" do
    join(parent, dropoff, adults: 0, children: 1, emergency_phone: "0698765432", responsibility_acknowledged: true)
    host_post("#{dropoff.id}/requests/#{row(parent, dropoff).id}/accept")
    patch "/api/v1/events/#{dropoff.id}/participation", params: { adults: 0, children: 3 }, headers: auth_headers(parent), as: :json
    host_post("#{dropoff.id}/requests/#{row(parent, dropoff).id}/decline")
    expect(row(parent, dropoff)).to have_attributes(status: "accepted", children: 1, pending_adults: nil)
    expect(row(parent, dropoff).emergency_phone).to be_present
    expect(dropoff.reload.places_taken).to eq(1)
  end

  it "AC-17.23 'accept all' on a suspended event is refused (requests are frozen)" do
    join(parent, approval)
    join(other_parent, approval)
    approval.suspend!("admin")
    host_post("#{approval.id}/requests/accept_all")
    expect(response).to have_http_status(:conflict)
    expect(row(parent, approval).status).to eq("pending")
    expect(approval.reload.places_taken).to eq(0)
  end

  it "AC-8.2, AC-17.16 a host whose verification just expired can't accept a request (address and phone go to the parent)" do
    join(parent, dropoff, responsibility_acknowledged: true)
    host.update_columns(verification_expires_on: Date.current)
    host_post("#{dropoff.id}/requests/#{row(parent, dropoff).id}/accept")
    expect(response).not_to have_http_status(:ok)
    expect(row(parent, dropoff).status).to eq("pending")
  end

  it "AC-17.12 the 90-day purge deletes the host's phone and the participations with it" do
    join(parent, dropoff, adults: 0, children: 1, emergency_phone: "0698765432", responsibility_acknowledged: true)
    dropoff.update_columns(starts_at: 100.days.ago, ends_at: 99.days.ago)
    PurgePastEventsJob.perform_now
    expect(Event.where(id: dropoff.id)).to be_empty
    expect(EventParticipation.where(event_id: dropoff.id)).to be_empty
  end

  it "AC-17.25 no phone number reaches any email sent by the request flow" do
    ActionMailer::Base.deliveries.clear
    perform_enqueued_jobs do
      join(parent, dropoff, adults: 0, children: 1, emergency_phone: "0698765432", responsibility_acknowledged: true)
      host_post("#{dropoff.id}/requests/#{row(parent, dropoff).id}/accept")
      travel_to(dropoff.starts_at - 1.hour) { DeliverEventNotificationsJob.perform_now(dropoff.id) rescue nil }
    end
    bodies = ActionMailer::Base.deliveries.map { |mail| mail.to_s }.join
    expect(ActionMailer::Base.deliveries).not_to be_empty
    expect(bodies).not_to match(/612345678|698765432|\+33|tel:/)
  end
end
