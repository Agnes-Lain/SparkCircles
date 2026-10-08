require "rails_helper"

RSpec.describe "GET /api/v1/me/agenda (my-space agenda)", type: :request do
  let(:parent) { create(:user, :verified) }
  let(:circle) { create(:circle, created_by: create(:user, :verified)) }

  def ids = json["events"].map { |event| event["id"] }

  def agenda(**params)
    get "/api/v1/me/agenda", params: params, headers: auth_headers(parent)
  end

  it "AC-1.1 lists my hosted and joined outings and my circles' outings, soonest first, with the viewer role" do
    hosted = create(:event, host: parent, starts_at: 2.days.from_now.change(hour: 10))
    joined = create(:event, starts_at: 1.day.from_now.change(hour: 10))
    create(:event_participation, event: joined, user: parent)
    create(:circle_membership, circle: circle, user: parent)
    outing = create(:event, host: circle.created_by, visibility: "circles", chosen_circle_ids: [ circle.id ],
                            starts_at: 3.days.from_now.change(hour: 10))

    agenda
    expect(response).to have_http_status(:ok)
    expect(ids).to eq([ joined.id, hosted.id, outing.id ])
    expect(json["events"].map { |event| event.dig("viewer", "role") }).to eq(%w[participant host member])
    expect(json["events"].last["visibility"]).to eq("circles")
    expect(json["window"]).to include("from" => Time.zone.today.iso8601, "to" => (Time.zone.today + 29).iso8601, "next_from" => nil)
  end

  it "AC-1.6 never lists drafts, past events, requests, other people's or other circles' events" do
    create(:event, :draft, host: parent)
    create(:event, :ended, host: parent)
    create(:event_participation, :pending, event: create(:event, :dropoff), user: parent)
    create(:event)
    create(:event, host: circle.created_by, visibility: "circles", chosen_circle_ids: [ circle.id ])

    agenda
    expect(ids).to be_empty
  end

  it "AC-1.5 keeps a cancelled outing only while it starts within 7 days" do
    soon = create(:event, host: parent, starts_at: 3.days.from_now)
    later = create(:event, host: parent, starts_at: 10.days.from_now)
    [ soon, later ].each { |event| event.update_columns(status: "cancelled") }

    agenda
    expect(ids).to eq([ soon.id ])
    expect(json["events"].first["status"]).to eq("cancelled")
  end

  it "AC-5.2 does not repeat a circle outing I joined as a circle outing" do
    create(:circle_membership, circle: circle, user: parent)
    outing = create(:event, host: circle.created_by, visibility: "circles", chosen_circle_ids: [ circle.id ])
    create(:event_participation, event: outing, user: parent)

    agenda
    expect(json["events"].map { |event| [ event["id"], event.dig("viewer", "role") ] }).to eq([ [ outing.id, "participant" ] ])
  end

  it "pages by 30 days from `from` and points to the next outing after the window" do
    near = create(:event, host: parent, starts_at: 2.days.from_now)
    far = create(:event, host: parent, starts_at: 45.days.from_now)

    agenda
    expect(ids).to eq([ near.id ])
    expect(json.dig("window", "next_from")).to eq(far.starts_at.to_date.iso8601)

    agenda(from: json.dig("window", "next_from"))
    expect(ids).to eq([ far.id ])
    expect(json.dig("window", "next_from")).to be_nil
  end

  it "never goes back before today and refuses an invalid date" do
    agenda(from: "2020-01-01")
    expect(json.dig("window", "from")).to eq(Time.zone.today.iso8601)

    agenda(from: "demain")
    expect(response).to have_http_status(:unprocessable_content)
    expect(json.dig("error", "details", "from")).to eq([ "invalid" ])
  end

  it "keeps the address and phone rules of the event serializers (participant, cancelled)" do
    joined = create(:event, starts_at: 2.days.from_now)
    create(:event_participation, event: joined, user: parent)
    agenda
    expect(json["events"].first).to have_key("exact_address")

    joined.update_columns(status: "cancelled")
    agenda
    expect(json["events"].first).not_to have_key("exact_address")
  end

  it "AC-8.2 hides circle outings of a host no longer in good standing, also from next_from" do
    create(:circle_membership, circle: circle, user: parent)
    lapsed = create(:event, host: circle.created_by, visibility: "circles", chosen_circle_ids: [ circle.id ],
                            starts_at: 2.days.from_now)
    create(:event, host: circle.created_by, visibility: "circles", chosen_circle_ids: [ circle.id ], starts_at: 40.days.from_now)
    joined = create(:event, host: circle.created_by, starts_at: 3.days.from_now)
    create(:event_participation, event: joined, user: parent)
    mine = create(:event, host: parent, starts_at: 50.days.from_now)
    circle.created_by.update_columns(verification_status: "not_verified", verification_expires_on: nil)

    agenda
    expect(ids).to eq([ joined.id ])
    expect(ids).not_to include(lapsed.id)
    expect(json.dig("window", "next_from")).to eq(mine.starts_at.to_date.iso8601)
  end

  it "AC-8.2 hides a circle outing whose host's verification expired before the daily job ran" do
    create(:circle_membership, circle: circle, user: parent)
    lapsed = create(:event, host: circle.created_by, visibility: "circles", chosen_circle_ids: [ circle.id ], starts_at: 2.days.from_now)
    later = create(:event, host: circle.created_by, visibility: "circles", chosen_circle_ids: [ circle.id ], starts_at: 40.days.from_now)
    # The daily VerificationExpiryJob hasn't run yet: the status still says "verified".
    circle.created_by.update_columns(verification_expires_on: Date.current)
    expect(circle.created_by.reload.verification_status).to eq("verified")
    agenda
    expect(ids).not_to include(lapsed.id, later.id)
    expect(json.dig("window", "next_from")).to be_nil
  end

  it "loads the page in a constant number of queries (no COUNT per hosted event)" do
    count_queries = lambda do
      queries = 0
      counter = ->(*, payload) { queries += 1 unless payload[:name].in?(%w[SCHEMA TRANSACTION]) || payload[:cached] }
      ActiveSupport::Notifications.subscribed(counter, "sql.active_record") { agenda }
      queries
    end
    add_hosted = lambda do |count|
      create_list(:event, count, :dropoff, host: parent, starts_at: 2.days.from_now).each do |event|
        create(:event_participation, :pending, event: event, user: create(:user, :verified))
      end
    end

    add_hosted.call(2)
    baseline = count_queries.call
    add_hosted.call(5)
    expect(count_queries.call).to eq(baseline)
    expect(json["events"].map { |event| event["pending_requests_count"] }).to all(eq(1))
  end

  it "answers 401 without a token" do
    get "/api/v1/me/agenda"
    expect(response).to have_http_status(:unauthorized)
  end

  it "answers 403 behind the closure gate" do
    parent.update_columns(closed_at: Time.current)
    agenda
    expect(response).to have_http_status(:forbidden)
  end
end
