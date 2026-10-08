require "rails_helper"

RSpec.describe "Circles", type: :request do
  let(:admin) { create(:user, :verified, first_name: "Claire", last_name: "Dubois") }
  let(:circle) { create(:circle, created_by: admin) }

  def join(target, user = create(:user, :verified), **attributes)
    create(:circle_membership, circle: target, user: user, **attributes)
  end

  describe "POST /circles" do
    let(:body) { { circle: { name: "Parents CE2 · Jaurès", description: "La classe de Mme Roux", area: "paris-11" } } }

    it "AC-1.1 creates a public circle (default, PM 2026-10-07) whose creator is the first admin and a member" do
      post "/api/v1/circles", params: body, headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:created)
      expect(json["circle"]).to include("name" => "Parents CE2 · Jaurès", "visibility" => "public", "my_role" => "admin",
                                        "creator" => true, "families_count" => 1, "premium_entitlement" => nil)
      expect(Circle.last.memberships.sole).to have_attributes(user_id: admin.id, role: "admin", status: "active")
      expect(AuditEvent.last).to have_attributes(action: "circle_created", actor_id: admin.id)
    end

    it "AC-17.1 creates a private circle flagged as a free premium entitlement" do
      post "/api/v1/circles", params: { circle: body[:circle].merge(visibility: "private") }, headers: auth_headers(admin), as: :json
      expect(json["circle"]).to include("visibility" => "private", "premium_entitlement" => "test_phase_free")
    end

    it "AC-1.2, AC-17.2 refuses a parent who isn't verified, even through the API" do
      post "/api/v1/circles", params: body, headers: auth_headers(create(:user, :pending_verification)), as: :json
      expect(response).to have_http_status(:forbidden)
      expect(error_code).to eq("verification_required")
      expect(Circle.count).to eq(0)
    end

    it "AC-1.3 answers field errors for contact details" do
      post "/api/v1/circles", params: { circle: body[:circle].merge(description: "lea@example.com") }, headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:unprocessable_content)
      expect(json.dig("error", "details", "description")).to eq([ "contains_email" ])
    end

    it "AC-1.4 refuses a fourth created circle" do
      create_list(:circle, 3, created_by: admin)
      post "/api/v1/circles", params: body, headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:conflict)
      expect(error_code).to eq("circle_create_limit")
    end

    it "AC-3.4 (PM 2026-10-07) counts created circles toward the 5-circle limit" do
      create_list(:circle, 2, created_by: admin)
      3.times { join(create(:circle), admin) }
      post "/api/v1/circles", params: body, headers: auth_headers(admin), as: :json
      expect(error_code).to eq("circle_member_limit")
    end
  end

  describe "GET /circles/:id" do
    it "AC-4.1, AC-4.2 shows members with first name, initial, badge and role, nothing private" do
      member = join(circle, create(:user, first_name: "Amir", last_name: "Khan", city_shown: "Paris"))
      get "/api/v1/circles/#{circle.id}", headers: auth_headers(member.user)
      expect(json.dig("circle", "audience")).to eq("member")
      rows = json.dig("circle", "members")
      expect(rows.map { |row| [ row["first_name"], row["last_name_initial"], row["role"], row["verified"] ] })
        .to eq([ [ "Claire", "D", "admin", true ], [ "Amir", "K", "member", false ] ])
      expect(rows.last["city_shown"]).to eq("Paris")
      expect(response.body).not_to include("Dubois", "Khan", admin.email, member.user.email)
      expect(json.dig("circle", "requests")).to eq([])
      expect(json.dig("circle", "can", "manage")).to be(false)
    end

    it "AC-4.6 answers 404 for a private circle to a non-member, an admin of another circle and a guest" do
      secret = create(:circle, :private, created_by: admin)
      other_admin = create(:circle).created_by
      get "/api/v1/circles/#{secret.id}", headers: auth_headers(other_admin)
      expect(response).to have_http_status(:not_found)
      get "/api/v1/circles/#{secret.id}", headers: guest_headers
      hidden = response.body
      expect(response).to have_http_status(:not_found)
      get "/api/v1/circles/#{SecureRandom.uuid}", headers: guest_headers
      expect(response.body).to eq(hidden)
    end

    it "AC-17.5 shows non-members of a public circle only its public fields, never a name" do
      join(circle, create(:user, first_name: "Amir"))
      get "/api/v1/circles/#{circle.id}", headers: auth_headers(create(:user))
      expect(json["circle"].keys).to match_array(%w[id audience name description area visibility families_count max_families
                                                     full run_by_verified_parent viewer])
      expect(json["circle"]).to include("audience" => "public", "families_count" => 2, "run_by_verified_parent" => true)
      expect(response.body).not_to include("Claire", "Amir")
    end

    it "AC-17.13 shows the viewer's own status on the public page" do
      requester = create(:user)
      join(circle, requester, status: "pending", requested_at: Time.current)
      get "/api/v1/circles/#{circle.id}", headers: auth_headers(requester)
      expect(json.dig("circle", "viewer")).to include("status" => "pending", "can_request" => false)
    end

    it "AC-17.10 lets a guest see a public circle (app headers required)" do
      get "/api/v1/circles/#{circle.id}", headers: guest_headers
      expect(json.dig("circle", "viewer")).to include("request_blocker" => "account_required")
      get "/api/v1/circles/#{circle.id}", headers: { "User-Agent" => "curl/8.0" }
      expect(error_code).to eq("client_not_allowed")
    end

    it "AC-7.3 a paused circle shows members nothing but its status" do
      member = join(circle)
      circle.update!(status: "suspended")
      get "/api/v1/circles/#{circle.id}", headers: auth_headers(member.user)
      expect(json["circle"]).to eq({ "id" => circle.id, "audience" => "member", "status" => "suspended" })
      get "/api/v1/circles/#{circle.id}", headers: auth_headers(create(:user))
      expect(response).to have_http_status(:not_found)
    end

    it "AC-2.4 shows admins with rights the pending requests with name, initial and badge" do
      join(circle, create(:user, :verified, first_name: "Inès", last_name: "Bah"), status: "pending", requested_at: 1.day.ago)
      get "/api/v1/circles/#{circle.id}", headers: auth_headers(admin)
      expect(json.dig("circle", "requests").sole).to include("first_name" => "Inès", "last_name_initial" => "B", "verified" => true)
    end
  end

  describe "PATCH /circles/:id" do
    it "AC-6.1, AC-6.6 lets an admin edit name, description and area" do
      patch "/api/v1/circles/#{circle.id}", params: { circle: { name: "Parents CM1", area: "paris-12" } }, headers: auth_headers(admin), as: :json
      expect(json["circle"]).to include("name" => "Parents CM1")
      expect(circle.reload.area).to eq("paris-12")
    end

    it "AC-17.3 switching to private hides the circle at once; links and members stay" do
      member = join(circle)
      patch "/api/v1/circles/#{circle.id}", params: { circle: { visibility: "private" } }, headers: auth_headers(admin), as: :json
      expect(AuditEvent.last.action).to eq("circle_visibility_changed")
      get "/api/v1/circles/#{circle.id}", headers: guest_headers
      expect(response).to have_http_status(:not_found)
      get "/api/v1/circles/#{circle.id}", headers: auth_headers(member.user)
      expect(json.dig("circle", "audience")).to eq("member")
    end

    it "refuses a member (403) and a non-member (404)" do
      member = join(circle)
      patch "/api/v1/circles/#{circle.id}", params: { circle: { name: "Hop" } }, headers: auth_headers(member.user), as: :json
      expect(error_code).to eq("forbidden")
      patch "/api/v1/circles/#{circle.id}", params: { circle: { name: "Hop" } }, headers: auth_headers(create(:user)), as: :json
      expect(response).to have_http_status(:not_found)
    end

    it "AC-6.5, AC-17.2 pauses the rights of an admin whose verification lapsed" do
      admin.update!(verification_status: "expired")
      patch "/api/v1/circles/#{circle.id}", params: { circle: { visibility: "public" } }, headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:forbidden)
      expect(error_code).to eq("admin_rights_paused")
      get "/api/v1/circles/#{circle.id}", headers: auth_headers(admin)
      expect(json.dig("circle", "admin_rights_paused")).to be(true)
    end

    it "AC-6.5, backlog #38 tells members whether the circle has a verified admin, private circles too" do
      private_circle = create(:circle, :private, created_by: admin)
      member = join(private_circle, create(:user))
      get "/api/v1/circles/#{private_circle.id}", headers: auth_headers(member.user)
      expect(json.dig("circle", "has_verified_admin")).to be(true)
      admin.update!(verification_status: "expired")
      get "/api/v1/circles/#{private_circle.id}", headers: auth_headers(member.user)
      expect(json["circle"]).to include("has_verified_admin" => false, "accepting_requests" => false)
    end
  end

  describe "DELETE /circles/:id" do
    it "AC-6.7 deletes a circle with no other verified member, and its circle-only events" do
      join(circle, create(:user))
      event = create(:event, host: admin, visibility: "circles", chosen_circle_ids: [ circle.id ])
      delete "/api/v1/circles/#{circle.id}", headers: auth_headers(admin)
      expect(response).to have_http_status(:no_content)
      expect(Circle.exists?(circle.id)).to be(false)
      expect(event.reload).to be_cancelled
    end

    it "AC-6.7 refuses while another verified member could run it" do
      join(circle)
      delete "/api/v1/circles/#{circle.id}", headers: auth_headers(admin)
      expect(error_code).to eq("circle_has_verified_members")
    end
  end

  describe "GET /circles (My circles)" do
    it "AC-9.2 lists my circles with role, families and requests to answer first" do
      calm = create(:circle, name: "Amis du square", created_by: admin)
      busy = create(:circle, name: "Zèbres du 11e", created_by: admin)
      join(busy, create(:user), status: "pending", requested_at: Time.current)
      get "/api/v1/circles", headers: auth_headers(admin)
      expect(json["items"].map { |item| item.dig("circle", "name") }).to eq([ busy.name, calm.name ])
      expect(json["items"].first["circle"]).to include("my_role" => "admin", "requests_count" => 1, "families_count" => 1)
      expect(json["limits"]).to include("created" => 2, "max_created" => 3, "circles" => 2, "can_create" => true)
    end

    it "AC-3.6, AC-9.1 lists my pending request and lets me cancel it" do
      requester = create(:user)
      join(circle, requester, status: "pending", requested_at: Time.current)
      get "/api/v1/circles", headers: auth_headers(requester)
      expect(json["items"].sole).to include("state" => "pending")
      expect(json["items"].sole["circle"]).to include("name" => circle.name, "id" => circle.id)
      delete "/api/v1/circles/#{circle.id}/join_request", headers: auth_headers(requester)
      expect(response).to have_http_status(:no_content)
      get "/api/v1/circles", headers: auth_headers(requester)
      expect(json["items"]).to eq([])
      expect(json["limits"]["can_create"]).to be(false)
    end

    it "AC-9.3, AC-5.2 shows a neutral card without data for a removal or a pause, until hidden" do
      removed = join(circle, create(:user), status: "removed")
      get "/api/v1/circles", headers: auth_headers(removed.user)
      expect(json["items"].sole).to eq({ "id" => removed.id, "state" => "removed", "circle" => nil })
      post "/api/v1/circle_cards/#{removed.id}/dismiss", headers: auth_headers(removed.user)
      expect(response).to have_http_status(:no_content)
      get "/api/v1/circles", headers: auth_headers(removed.user)
      expect(json["items"]).to eq([])

      circle.update!(status: "suspended")
      get "/api/v1/circles", headers: auth_headers(admin)
      expect(json["items"].sole).to include("state" => "paused", "circle" => nil)
    end

    it "shows a declined request as a status card with the circle name only, until hidden (PM 2026-10-07)" do
      declined = join(circle, create(:user), status: "declined")
      get "/api/v1/circles", headers: auth_headers(declined.user)
      expect(json["items"].sole).to eq({ "id" => declined.id, "state" => "declined", "circle" => { "name" => circle.name } })
      post "/api/v1/circle_cards/#{declined.id}/dismiss", headers: auth_headers(declined.user)
      expect(response).to have_http_status(:no_content)
      get "/api/v1/circles", headers: auth_headers(declined.user)
      expect(json["items"]).to eq([])
      expect(declined.reload.status).to eq("declined")
    end

    it "won't hide an active circle's card" do
      post "/api/v1/circle_cards/#{circle.memberships.first.id}/dismiss", headers: auth_headers(admin)
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET /circles/:id/activity" do
    it "AC-5.5 shows admins who did what; members can't see it" do
      member = join(circle)
      delete "/api/v1/circles/#{circle.id}/members/#{member.id}", headers: auth_headers(admin)
      get "/api/v1/circles/#{circle.id}/activity", headers: auth_headers(admin)
      expect(json["entries"].first).to include("action" => "circle_member_removed", "actor" => { "first_name" => "Claire", "last_name_initial" => "D" })
      other = join(circle)
      get "/api/v1/circles/#{circle.id}/activity", headers: auth_headers(other.user)
      expect(response).to have_http_status(:forbidden)
    end
  end
end
