require "rails_helper"

RSpec.describe "Profile, privacy and visibility", type: :request do
  let(:user) { create(:user, city_shown: "Croix-Rousse, Lyon") }
  let(:headers) { auth_headers(user) }

  describe "GET /api/v1/users/:id" do
    let(:viewer) { create(:user) }

    it "AC-6.1 AC-6.4 returns only the public fields" do
      get "/api/v1/users/#{user.id}", headers: auth_headers(viewer)

      expect(response).to have_http_status(:ok)
      expect(json).to eq("id" => user.id, "first_name" => "Claire", "last_name_initial" => "M", "photo_url" => nil,
                         "verified" => false, "city_shown" => "Croix-Rousse, Lyon")
    end

    it "AC-6.2 AC-6.4 never exposes email, full last name, date of birth or verification details, even to admins" do
      user.update!(date_of_birth: Date.new(1990, 1, 1))
      admin = create(:user, :admin)

      get "/api/v1/users/#{user.id}", headers: auth_headers(admin)

      body = response.body
      expect(body).not_to include(user.email, "Martin", "1990", "verification_status")
      expect(json.keys).to eq(%w[id first_name last_name_initial photo_url verified city_shown])
    end

    it "AC-8.1 AC-8.2 shows a verified badge as a boolean and never the reason" do
      rejected = create(:user, verification_status: "rejected")
      verified = create(:user, :verified)

      get "/api/v1/users/#{rejected.id}", headers: auth_headers(viewer)
      expect(json["verified"]).to be(false)
      expect(response.body).not_to include("rejected")

      get "/api/v1/users/#{verified.id}", headers: auth_headers(viewer)
      expect(json["verified"]).to be(true)
    end

    it "AC-11.2 hides closed accounts" do
      user.update!(closed_at: Time.current)

      get "/api/v1/users/#{user.id}", headers: auth_headers(viewer)
      expect(response).to have_http_status(:not_found)
    end

    it "requires a logged-in member" do
      get "/api/v1/users/#{user.id}"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/me/public_profile" do
    it "AC-6.3 previews the profile exactly as others see it" do
      get "/api/v1/me/public_profile", headers: headers
      preview = json

      get "/api/v1/users/#{user.id}", headers: auth_headers(create(:user))
      expect(preview).to eq(json)
    end
  end

  describe "PATCH /api/v1/me" do
    it "AC-6.1 updates the profile fields shown to others" do
      patch "/api/v1/me", params: { user: { first_name: "Clara", city_shown: "" } }, headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      expect(json).to include("first_name" => "Clara", "city_shown" => nil)
    end

    it "AC-7.8 removes the verified status when a verified parent changes their name" do
      user.update!(verification_status: "verified", verification_expires_on: 1.year.from_now.to_date)

      patch "/api/v1/me", params: { user: { last_name: "Durand" } }, headers: headers, as: :json

      expect(json.dig("verification", "status")).to eq("not_verified")
      expect(user.reload).not_to be_verified
    end

    it "AC-7.8 keeps the verified status when only the neighborhood changes" do
      user.update!(verification_status: "verified", verification_expires_on: 1.year.from_now.to_date)

      patch "/api/v1/me", params: { user: { city_shown: "Lyon 4e" } }, headers: headers, as: :json

      expect(user.reload).to be_verified
    end

    it "ignores email and role changes" do
      patch "/api/v1/me", params: { user: { email: "x@example.com", roles: [ "admin" ] } }, headers: headers, as: :json

      expect(user.reload.email).not_to eq("x@example.com")
      expect(user.role_names).to eq([ "parent" ])
    end

    it "returns validation errors" do
      patch "/api/v1/me", params: { user: { first_name: "" } }, headers: headers, as: :json

      expect(json.dig("error", "details", "first_name")).to eq([ "blank" ])
    end
  end

  describe "PUT /api/v1/me/marketing" do
    it "AC-5.4 applies the marketing choice at once and records its date" do
      freeze_time do
        put "/api/v1/me/marketing", params: { marketing_opt_in: true }, headers: headers, as: :json

        expect(json["marketing_opt_in"]).to be(true)
        expect(json["marketing_opt_in_changed_at"]).to eq(Time.current.utc.iso8601)
      end
    end
  end

  describe "AC-5.5 new terms version" do
    before do
      headers # the account accepted version 1.0 before the change
      allow(Rails.configuration.x).to receive(:legal).and_return(
        Rails.configuration.x.legal.merge(terms_version: "1.1", privacy_version: "1.1", changes: { en: [ "New rule" ] })
      )
    end

    it "blocks the app until the new version is accepted" do
      get "/api/v1/me", headers: headers
      expect(json["terms_acceptance_required"]).to be(true)

      get "/api/v1/verification", headers: headers
      expect(error_code).to eq("terms_acceptance_required")

      get "/api/v1/legal", headers: headers.merge("Accept-Language" => "en")
      expect(json).to include("requires_acceptance" => true, "changes" => [ "New rule" ])

      post "/api/v1/me/terms_acceptance", params: { terms_version: "1.1", privacy_version: "1.1" }, headers: headers, as: :json
      expect(response).to have_http_status(:ok)
      expect(json.dig("consents", "terms_version")).to eq("1.1")

      get "/api/v1/verification", headers: headers
      expect(response).to have_http_status(:ok)
    end

    it "refuses an outdated version" do
      post "/api/v1/me/terms_acceptance", params: { terms_version: "1.0", privacy_version: "1.0" }, headers: headers, as: :json

      expect(error_code).to eq("validation_failed")
    end
  end
end
