require "rails_helper"

RSpec.describe "Circle search", type: :request do
  def search(params = {}, headers = guest_headers)
    get "/api/v1/circles/search", params: params, headers: headers
  end

  def names = json["circles"].map { |circle| circle["name"] }

  it "AC-17.8 finds only public, active circles run by a verified admin" do
    create(:circle, name: "Parents du 11e")
    create(:circle, :private, name: "Secret du 11e")
    create(:circle, :suspended, name: "Pause du 11e")
    lapsed = create(:circle, name: "Sans admin du 11e")
    lapsed.created_by.update!(verification_status: "expired")
    search(area: "paris")
    expect(names).to eq([ "Parents du 11e" ])
  end

  it "AC-17.8 filters by areas and by text on name and description (2 characters at least)" do
    create(:circle, name: "Parents CE2", area: "paris-11")
    create(:circle, name: "Voisins", description: "Immeuble rue Saint-Maur", area: "paris-11")
    create(:circle, name: "Parents du 20e", area: "paris-20")
    search(area: [ "paris-11" ], q: "maur")
    expect(names).to eq([ "Voisins" ])
    search(area: "paris", q: "m")
    expect(json.dig("error", "details", "q")).to eq([ "out_of_range" ])
  end

  it "AC-17.8 sorts by proximity to the chosen area, then by size" do
    small = create(:circle, name: "Petit 11e", area: "paris-11")
    big = create(:circle, name: "Grand 11e", area: "paris-11")
    create_list(:circle_membership, 2, circle: big)
    create(:circle, name: "Loin 16e", area: "paris-16")
    search(area: "paris", near: "paris-11")
    expect(names).to eq([ big.name, small.name, "Loin 16e" ])
  end

  it "AC-17.9 has no total count, a page cap for guests, and needs the app headers" do
    create(:circle)
    search(area: "paris")
    expect(json.keys).to match_array(%w[circles pagination])
    expect(json["pagination"].keys).to match_array(%w[page per_page next_page])
    search(area: "paris", page: 6)
    expect(json.dig("error", "details", "page")).to eq([ "too_far" ])
    search({ area: "paris" }, { "User-Agent" => "python-requests/2.31" })
    expect(error_code).to eq("client_not_allowed")
  end

  it "AC-17.9 rate-limits guests and blocks after repeated hits" do
    31.times { search(area: "paris") }
    expect(response).to have_http_status(:too_many_requests)
  end

  it "AC-17.5, AC-17.11 results carry only public fields, a full circle stays listed marked full" do
    circle = create(:circle)
    create_list(:circle_membership, 24, circle: circle)
    search({ area: "paris" }, auth_headers(create(:user)))
    expect(json["circles"].sole).to include("full" => true, "run_by_verified_parent" => true)
    expect(json["circles"].sole.dig("viewer", "request_blocker")).to eq("full")
    expect(response.body).not_to include(circle.created_by.first_name)
  end

  it "AC-17.14 a closed circle leaves search at once" do
    circle = create(:circle)
    Circles::Departure.new(circle).close!
    search(area: "paris")
    expect(json["circles"]).to eq([])
  end
end
