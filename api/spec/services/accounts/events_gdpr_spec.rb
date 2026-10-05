require "rails_helper"

# QA: GDPR for Events (accounts spec US-11 erasure, US-12 data copy; events AC-8.5, AC-7.5).
RSpec.describe "Events and the user's data" do
  let(:host) { create(:user, :verified, first_name: "Claire", last_name: "Martin") }
  let!(:hosted) { create(:event, host: host, exact_address: "12 rue Oberkampf, 75011 Paris") }
  let(:other_host) { create(:user, :verified) }
  let!(:joined) { create(:event, host: other_host) }

  before do
    create(:event_participation, event: joined, user: host, adults: 1, children: 2)
    create(:event_participation, event: hosted, user: create(:user))
    EventReport.create!(event: joined, reporter: host, reason: "other", details: "texte libre")
  end

  it "AC-12.1 BUG-7 includes the user's hosted events, participations and reports in the data copy" do
    data = Accounts::DataExportBuilder.new(host).as_json
    expect(JSON.generate(data)).to include("Football au parc", "12 rue Oberkampf")
  end

  it "AC-12.1 lists hosted events with their address, participations with places, and reports sent" do
    data = Accounts::DataExportBuilder.new(host).as_json
    expect(data[:hosted_events].sole).to include(id: hosted.id, exact_address: "12 rue Oberkampf, 75011 Paris",
                                                 places_total: hosted.places_total, places_taken: 2, status: "published")
    expect(data[:event_participations].sole).to include(event_id: joined.id, event_title: joined.title, adults: 1, children: 2,
                                                        places: 3, event_starts_at: joined.starts_at.utc.iso8601)
    expect(data[:event_reports].sole).to include(event_id: joined.id, reason: "other", details: "texte libre")
    # Other people's data stays out of this user's copy.
    expect(JSON.generate(data[:hosted_events])).not_to include("participants")
  end

  it "AC-8.5 closing cancels hosted events and frees the places the user held elsewhere" do
    Accounts::Closure.new(host).close!
    expect(hosted.reload.status).to eq("cancelled")
    expect(EventParticipation.where(user: host)).to be_empty
    expect(joined.reload.places_taken).to eq(0)
  end

  it "US-11 erasure deletes the hosted events and participations, unlinks reports, keeps counts consistent" do
    Accounts::Closure.new(host).close!
    Accounts::Eraser.new(host.reload).erase!
    expect(Event.where(id: hosted.id)).to be_empty
    expect(EventParticipation.where(event_id: hosted.id)).to be_empty
    expect(EventParticipation.where(event_id: joined.id).sum(:places)).to eq(joined.reload.places_taken)
    expect(EventReport.where(event_id: joined.id).pluck(:reporter_id, :details)).to eq([ [ nil, nil ] ])
  end
end
