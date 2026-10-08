require "rails_helper"

# AC-6.4b: the host sees the adults and children of the party, now and if a request is accepted.
RSpec.describe "Events: party totals for the host", type: :request do
  let(:host) { create(:user, :verified) }
  let(:event) { create(:event, :with_approval, host: host, places_total: 20) }

  it "AC-6.4b the request list gives the accepted totals and the totals if each request is accepted" do
    create(:event_participation, event: event, adults: 2, children: 1)
    extra = create(:event_participation, event: event, adults: 1, children: 0)
    extra.update_columns(pending_adults: 1, pending_children: 2, requested_at: Time.current)
    pending = create(:event_participation, :pending, event: event, adults: 1, children: 0)

    get "/api/v1/events/#{event.id}/requests", headers: auth_headers(host)

    expect(response).to have_http_status(:ok)
    expect(json["totals"]).to eq("adults" => 3, "children" => 1)
    by_id = json["requests"].index_by { |request| request["id"] }
    expect(by_id[pending.id]).to include("adults" => 1, "children" => 0, "if_accepted" => { "adults" => 4, "children" => 1 })
    expect(by_id[extra.id]).to include("extra" => true, "adults" => 1, "children" => 2,
                                       "if_accepted" => { "adults" => 3, "children" => 3 })
  end

  it "AC-6.4b totals are zero with nobody accepted yet" do
    get "/api/v1/events/#{event.id}/requests", headers: auth_headers(host)
    expect(json["totals"]).to eq("adults" => 0, "children" => 0)
  end
end
