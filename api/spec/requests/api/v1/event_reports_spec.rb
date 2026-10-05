require "rails_helper"

RSpec.describe "Events: reports", type: :request do
  let(:event) { create(:event) }
  let(:member) { create(:user) }
  let(:path) { "/api/v1/events/#{event.id}/reports" }

  it "AC-9.1, AC-3.11 records a report with a reason (inappropriate tag included) and optional details" do
    post path, params: { reason: "inappropriate_tag", details: "Un tag avec un prénom" }, headers: auth_headers(member), as: :json
    expect(response).to have_http_status(:created)
    expect(json["report"]).to include("reason" => "inappropriate_tag")
    expect(EventReport.last).to have_attributes(reporter: member, details: "Un tag avec un prénom")
  end

  it "AC-9.2 never reveals the reporter to the host" do
    post path, params: { reason: "other" }, headers: auth_headers(member), as: :json
    get "/api/v1/events/#{event.id}", headers: auth_headers(event.host)
    expect(response.body).not_to include(member.id, "report")
  end

  it "validates the reason and the 500-character details" do
    post path, params: { reason: "spam", details: "x" * 501 }, headers: auth_headers(member), as: :json
    expect(json.dig("error", "details")).to eq("reason" => [ "inclusion" ], "details" => [ "too_long" ])
  end

  it "accepts one report per member and event" do
    2.times { post path, params: { reason: "other" }, headers: auth_headers(member), as: :json }
    expect(error_code).to eq("already_reported")
  end

  it "AC-9.1 asks guests to log in (AC-15.5)" do
    post path, params: { reason: "other" }, headers: guest_headers, as: :json
    expect(response).to have_http_status(:unauthorized)
  end

  it "refuses reporting a draft someone can't see, or one's own event" do
    draft = create(:event, :draft)
    post "/api/v1/events/#{draft.id}/reports", params: { reason: "other" }, headers: auth_headers(member), as: :json
    expect(response).to have_http_status(:not_found)
    post path, params: { reason: "other" }, headers: auth_headers(event.host), as: :json
    expect(error_code).to eq("own_event")
  end
end
