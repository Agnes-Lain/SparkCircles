require "rails_helper"

# Spec events, amendment 2026-10-06: event language (AC-16.1 to AC-16.3).
RSpec.describe "Events: language", type: :request do
  let(:host) { create(:user, :verified) }
  let(:starts_at) { 5.days.from_now.change(hour: 14) }
  let(:attributes) do
    { title: "Park picnic", category: "outdoors", starts_at: starts_at.iso8601, ends_at: (starts_at + 2.hours).iso8601,
      area: "paris-11", exact_address: "3 rue de la Roquette, 75011 Paris", places_total: 8, join_rule: "anyone" }
  end

  describe "POST /api/v1/events" do
    it "AC-16.1 keeps the language the host chose" do
      post "/api/v1/events", params: { event: attributes.merge(language: "en") }, headers: auth_headers(host), as: :json
      expect(response).to have_http_status(:created)
      expect(json.dig("event", "language")).to eq("en")
    end

    it "AC-16.1 defaults a draft to the app language (Accept-Language)" do
      post "/api/v1/events", params: { event: { title: "Picnic" } },
                             headers: auth_headers(host).merge("Accept-Language" => "en"), as: :json
      expect(json.dig("event", "language")).to eq("en")

      post "/api/v1/events", params: { event: { title: "Pique-nique", language: nil } },
                             headers: auth_headers(host).merge("Accept-Language" => "fr"), as: :json
      expect(json.dig("event", "language")).to eq("fr")
    end

    it "AC-16.1 refuses another language" do
      post "/api/v1/events", params: { event: attributes.merge(language: "de") }, headers: auth_headers(host), as: :json
      expect(response).to have_http_status(:unprocessable_content)
      expect(json.dig("error", "details")).to eq("language" => [ "inclusion" ])
    end
  end

  describe "PATCH /api/v1/events/:id" do
    let(:event) { create(:event, host: host, language: "fr") }

    it "AC-16.1 lets the host change the language, even once published" do
      patch "/api/v1/events/#{event.id}", params: { event: { language: "en" } }, headers: auth_headers(host), as: :json
      expect(response).to have_http_status(:ok)
      expect(event.reload.language).to eq("en")
    end

    it "AC-16.1 a published event always has a language" do
      patch "/api/v1/events/#{event.id}", params: { event: { language: nil } }, headers: auth_headers(host), as: :json
      expect(response).to have_http_status(:unprocessable_content)
      expect(json.dig("error", "details")).to eq("language" => [ "blank" ])
    end
  end

  describe "GET /api/v1/events" do
    let!(:french) { create(:event, host: host, language: "fr") }
    let!(:english) { create(:event, host: host, language: "en") }

    it "AC-16.2 serializes the language for guests and members" do
      get "/api/v1/events", params: { area: "paris" }, headers: guest_headers
      expect(json["events"].to_h { |item| [ item["id"], item["language"] ] }).to eq(french.id => "fr", english.id => "en")

      get "/api/v1/events/#{english.id}", headers: auth_headers(create(:user))
      expect(json.dig("event", "language")).to eq("en")
    end

    it "AC-16.3 filters by language; no filter lists every language" do
      get "/api/v1/events", params: { area: "paris", language: "en" }, headers: guest_headers
      expect(json["events"].map { |item| item["id"] }).to eq([ english.id ])

      get "/api/v1/events", headers: auth_headers(create(:user))
      expect(json["events"].map { |item| item["id"] }).to contain_exactly(french.id, english.id)
    end

    it "AC-16.3 refuses an unknown or non-scalar language" do
      get "/api/v1/events", params: { area: "paris", language: "de" }, headers: guest_headers
      expect(response).to have_http_status(:unprocessable_content)
      expect(json.dig("error", "details")).to eq("language" => [ "inclusion" ])

      get "/api/v1/events", params: { area: "paris", language: [ "en" ] }, headers: guest_headers
      expect(json.dig("error", "details")).to eq("language" => [ "invalid" ])
    end
  end
end
