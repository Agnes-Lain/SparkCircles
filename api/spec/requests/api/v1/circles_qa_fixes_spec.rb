require "rails_helper"

# Fixes from the Circles v1 QA report (B1 to B4, B6) and the PM decisions of 2026-10-07.
RSpec.describe "Circles v1 QA fixes", type: :request do
  let(:admin) { create(:user, :verified, first_name: "Claire") }
  let(:circle) { create(:circle, created_by: admin) }

  def member(user = create(:user, :verified), **attributes)
    create(:circle_membership, circle: circle, user: user, **attributes)
  end

  describe "B1: a host who left or was removed can't publish a draft into the circle" do
    let(:host_row) { member }
    let(:host) { host_row.user }
    let(:other_circle) { create(:circle, name: "Voisins") }

    def draft(circle_ids = [ circle.id ])
      create(:event, host: host, status: "draft", visibility: "circles", chosen_circle_ids: circle_ids)
    end

    def publish(event)
      post "/api/v1/events/#{event.id}/publish", headers: auth_headers(host)
    end

    it "AC-5.2, AC-2.7, AC-16.1 removal drops the circle from the host's draft, which can't be published then" do
      event = draft
      delete "/api/v1/circles/#{circle.id}/members/#{host_row.id}", headers: auth_headers(admin)
      expect(response).to have_http_status(:ok)
      expect(event.reload).to be_draft
      expect(event.event_circles).to be_empty

      publish(event)
      expect(response).to have_http_status(:unprocessable_content)
      expect(json.dig("error", "details", "circle_ids")).to eq([ "blank" ])
      get "/api/v1/events", params: { area: "paris" }, headers: auth_headers(admin)
      expect(json["events"]).to eq([])
    end

    it "AC-5.1, AC-16.6 leaving drops only that circle from a draft chosen for two circles" do
      create(:circle_membership, circle: other_circle, user: host)
      event = draft([ circle.id, other_circle.id ])
      delete "/api/v1/circles/#{circle.id}/membership", headers: auth_headers(host)
      expect(response).to have_http_status(:no_content)
      expect(event.reload.event_circles.map(&:circle_id)).to eq([ other_circle.id ])
      publish(event)
      expect(response).to have_http_status(:ok)
      expect(json.dig("event", "circles").map { |c| c["id"] }).to eq([ other_circle.id ])
    end

    it "AC-16.1 checks the stored circles at publish time, even when the request sends none" do
      event = draft
      host_row.update_columns(status: "removed") # a link left behind, whatever the cause
      publish(event)
      expect(response).to have_http_status(:unprocessable_content)
      expect(json.dig("error", "details", "circle_ids")).to eq([ "inclusion" ])
      expect(event.reload).to be_draft
    end

    it "AC-7.3 refuses to publish a draft into a paused circle, and to save the draft with it" do
      event = draft
      circle.update!(status: "suspended")
      publish(event)
      expect(json.dig("error", "details", "circle_ids")).to eq([ "inclusion" ])
      patch "/api/v1/events/#{event.id}", params: { event: { title: "Nouveau titre" } }, headers: auth_headers(host), as: :json
      expect(json.dig("error", "details", "circle_ids")).to eq([ "inclusion" ])
    end

    it "AC-16.9 keeps editing a published event possible after its circle is paused" do
      event = create(:event, host: host, visibility: "circles", chosen_circle_ids: [ circle.id ])
      circle.update!(status: "suspended")
      patch "/api/v1/events/#{event.id}", params: { event: { description: "Avec un goûter." } }, headers: auth_headers(host), as: :json
      expect(response).to have_http_status(:ok)
    end
  end

  describe "B2: a paused or closed circle refuses every admin action and every join (AC-7.3)" do
    let!(:co_admin) { member(role: "admin", admin_since: Time.current) }
    let!(:plain) { member }
    let!(:request_row) { member(create(:user), status: "pending", requested_at: Time.current, joined_at: nil) }

    before { circle.update!(status: "suspended", suspended_at: Time.current) }

    it "answers circle_paused to the admin, whatever the action" do
      headers = auth_headers(admin)
      [
        -> { get "/api/v1/circles/#{circle.id}/invitation", headers: headers },
        -> { post "/api/v1/circles/#{circle.id}/invitation", headers: headers },
        -> { patch "/api/v1/circles/#{circle.id}/invitation", params: { enabled: false }, headers: headers, as: :json },
        -> { patch "/api/v1/circles/#{circle.id}", params: { circle: { name: "Autre nom" } }, headers: headers, as: :json },
        -> { delete "/api/v1/circles/#{circle.id}", headers: headers },
        -> { get "/api/v1/circles/#{circle.id}/activity", headers: headers },
        -> { post "/api/v1/circles/#{circle.id}/requests/#{request_row.id}/accept", headers: headers },
        -> { post "/api/v1/circles/#{circle.id}/requests/#{request_row.id}/decline", headers: headers },
        -> { delete "/api/v1/circles/#{circle.id}/members/#{plain.id}", headers: headers },
        -> { post "/api/v1/circles/#{circle.id}/members/#{plain.id}/promote", headers: headers },
        -> { post "/api/v1/circles/#{circle.id}/membership/step_down", headers: headers }
      ].each do |call|
        call.call
        expect(response).to have_http_status(:forbidden)
        expect(error_code).to eq("circle_paused")
      end
      expect(json.dig("error", "message")).to eq("Ce cercle est en pause.")
      expect(circle.reload.name).not_to eq("Autre nom")
      expect(request_row.reload).to be_pending
      expect(plain.reload).to be_active
      expect(co_admin.reload).to be_admin
    end

    it "answers circle_closed for a closed circle" do
      circle.update!(status: "closed", closed_at: Time.current)
      get "/api/v1/circles/#{circle.id}/invitation", headers: auth_headers(admin)
      expect(response).to have_http_status(:forbidden)
      expect(error_code).to eq("circle_closed")
    end

    it "refuses joining: a member asking gets circle_paused, others the neutral answers" do
      post "/api/v1/circles/#{circle.id}/join_request", headers: auth_headers(plain.user)
      expect(error_code).to eq("circle_paused")
      post "/api/v1/circles/#{circle.id}/join_request", headers: auth_headers(create(:user))
      expect(response).to have_http_status(:not_found)
      post "/api/v1/circle_invitations/join", params: { code: circle.formatted_code }, headers: auth_headers(create(:user)), as: :json
      expect(response).to have_http_status(:gone)
    end

    it "lets members leave and report, and shows them the status only" do
      post "/api/v1/circles/#{circle.id}/reports", params: { reason: "unsafe" }, headers: auth_headers(plain.user), as: :json
      expect(response).to have_http_status(:created)
      get "/api/v1/circles/#{circle.id}", headers: auth_headers(plain.user)
      expect(json["circle"]).to eq("id" => circle.id, "audience" => "member", "status" => "suspended")
      delete "/api/v1/circles/#{circle.id}/membership", headers: auth_headers(plain.user)
      expect(response).to have_http_status(:no_content)
    end

    it "refuses accepting in the service too (paused between loading and acting)" do
      expect { Circles::Requests.new(circle).accept!(request_row, by: admin) }
        .to raise_error(Circles::Error) { |error| expect(error.code).to eq(:circle_paused) }
      expect { Circles::Requests.new(circle).ask!(create(:user)) }
        .to raise_error(Circles::Error) { |error| expect(error.code).to eq(:circle_paused) }
    end
  end

  describe "B3: forced private holds until SparkCircles staff lift it (AC-17.7)" do
    before { circle.update_columns(visibility: "private", premium_entitlement: Circle::PRIVATE_ENTITLEMENT, forced_private_at: Time.current) }

    it "refuses switching to public with circle_forced_private; other edits still work" do
      patch "/api/v1/circles/#{circle.id}", params: { circle: { visibility: "public" } }, headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:forbidden)
      expect(error_code).to eq("circle_forced_private")
      expect(circle.reload).to be_private

      patch "/api/v1/circles/#{circle.id}", params: { circle: { name: "Parents CM1" } }, headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:ok)
      expect(json["circle"]).to include("name" => "Parents CM1", "visibility" => "private", "forced_private" => true)
    end

    it "the model and the database refuse it too" do
      circle.visibility = "public"
      expect(circle).not_to be_valid
      expect(circle.errors.details[:visibility]).to include(error: :forced_private)
      expect { circle.update_columns(visibility: "public") }.to raise_error(ActiveRecord::StatementInvalid, /circles_forced_private_check/)
    end

    it "lets the admins go public again once lifted" do
      circle.update_columns(forced_private_at: nil)
      patch "/api/v1/circles/#{circle.id}", params: { circle: { visibility: "public" } }, headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:ok)
      expect(json["circle"]).to include("visibility" => "public", "forced_private" => false)
    end
  end

  describe "B4: a malformed body answers 400, not 500" do
    it "POST /circles and PATCH /circles/:id with circle as a string" do
      post "/api/v1/circles", params: { circle: "x" }, headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:bad_request)
      expect(error_code).to eq("bad_request")
      patch "/api/v1/circles/#{circle.id}", params: { circle: [ "x" ] }, headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:bad_request)
    end

    it "POST /events and PATCH /events/:id with event as a string" do
      post "/api/v1/events", params: { event: "x" }, headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:bad_request)
      event = create(:event, host: admin)
      patch "/api/v1/events/#{event.id}", params: { event: "x" }, headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:bad_request)
    end
  end

  describe "B6: wrong invitation codes are counted per account and per device (AC-2.8)" do
    def wrong_code(headers)
      post "/api/v1/circle_invitations/preview", params: { code: "ZZZZ-ZZZ#{rand(2..9)}" }, headers: headers, as: :json
    end

    def good_code(headers)
      post "/api/v1/circle_invitations/preview", params: { code: circle.formatted_code }, headers: headers, as: :json
    end

    it "10 wrong codes on one account don't lock out another parent on the same network" do
      blocked = create(:user)
      10.times { wrong_code(auth_headers(blocked)) }
      good_code(auth_headers(blocked))
      expect(error_code).to eq("too_many_tries")
      good_code(auth_headers(create(:user)))
      expect(response).to have_http_status(:ok)
    end

    it "counts per device, for guests and across accounts on one device" do
      device = guest_headers
      10.times { wrong_code(device) }
      good_code(device)
      expect(error_code).to eq("too_many_tries")
      good_code(auth_headers(create(:user)).merge(device))
      expect(error_code).to eq("too_many_tries")
      good_code(guest_headers("X-SparkCircles-Device" => "0a1b2c3d-1111-4222-8333-444455556666"))
      expect(response).to have_http_status(:ok)
    end

    it "keeps a high per-network ceiling" do
      stub_const("Api::V1::CircleInvitationsController::WRONG_TRIES_PER_IP", 3)
      3.times { wrong_code(auth_headers(create(:user))) }
      good_code(auth_headers(create(:user)))
      expect(error_code).to eq("too_many_tries")
    end
  end
end
