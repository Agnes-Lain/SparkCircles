require "rails_helper"

RSpec.describe "Circle invitations and join requests", type: :request do
  let(:admin) { create(:user, :verified, first_name: "Claire", last_name: "Dubois") }
  let(:circle) { create(:circle, :private, created_by: admin) }
  let(:parent) { create(:user) }

  def preview(body, headers = auth_headers(parent))
    post "/api/v1/circle_invitations/preview", params: body, headers: headers, as: :json
  end

  def join(body, user = parent)
    post "/api/v1/circle_invitations/join", params: body, headers: auth_headers(user), as: :json
  end

  describe "admin invitation" do
    it "AC-2.1 gives admins a shareable link and a short code" do
      get "/api/v1/circles/#{circle.id}/invitation", headers: auth_headers(admin)
      expect(json["invitation"]).to include("enabled" => true, "full" => false, "code" => circle.formatted_code)
      expect(json.dig("invitation", "link")).to end_with("/join/#{circle.invite_token}")
    end

    it "AC-2.2 renewing stops the old link and code at once; members and requests stay" do
      requester = create(:circle_membership, :pending, circle: circle)
      old = circle.formatted_code
      post "/api/v1/circles/#{circle.id}/invitation", headers: auth_headers(admin)
      expect(json.dig("invitation", "code")).not_to eq(old)
      preview(code: old)
      expect(response).to have_http_status(:gone)
      expect(requester.reload).to be_pending
    end

    it "AC-2.10 lets admins turn the invitation off and on; members can't see it" do
      patch "/api/v1/circles/#{circle.id}/invitation", params: { enabled: false }, headers: auth_headers(admin), as: :json
      expect(json.dig("invitation", "enabled")).to be(false)
      preview(code: circle.formatted_code)
      expect(error_code).to eq("invitation_invalid")
      member = create(:circle_membership, circle: circle)
      get "/api/v1/circles/#{circle.id}/invitation", headers: auth_headers(member.user)
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "POST /circle_invitations/preview" do
    it "AC-3.1 shows name, area, families and the admin's first name, initial and badge; no description or members" do
      preview(token: circle.invite_token)
      expect(json["circle"]).to include("name" => circle.name, "families_count" => 1,
                                        "admin" => { "first_name" => "Claire", "last_name_initial" => "D", "verified" => true })
      expect(json["circle"]).not_to have_key("description")
      expect(json["circle"]).not_to have_key("members")
      expect(json["circle"]).not_to have_key("id")
    end

    it "AC-3.3 works for guests from the app" do
      preview({ code: circle.formatted_code }, guest_headers)
      expect(json.dig("circle", "viewer", "request_blocker")).to eq("account_required")
      expect(json.dig("circle", "admin")).to be_nil
    end

    it "AC-3.5 gives one neutral answer for an unknown, renewed or turned-off invitation, and a paused circle" do
      preview(code: "ZZZZ-ZZZZ")
      unknown = json
      circle.update!(status: "suspended")
      preview(code: circle.formatted_code)
      expect(response).to have_http_status(:gone)
      expect(json).to eq(unknown)
      expect(json.dig("error", "message")).to eq("Cette invitation n'est plus valide. Demande à la personne qui t'a envoyé l'invitation.")
    end

    it "AC-2.8 refuses further tries after 10 wrong codes in an hour" do
      10.times { preview(code: "ZZZZ-ZZZ#{rand(2..9)}") }
      preview(code: circle.formatted_code)
      expect(response).to have_http_status(:too_many_requests)
      expect(error_code).to eq("too_many_tries")
      travel 61.minutes do
        preview(code: circle.formatted_code)
        expect(response).to have_http_status(:ok)
      end
    end
  end

  describe "POST /circle_invitations/join" do
    it "AC-2.3, AC-3.2 creates a join request (even unverified), not a membership, and e-mails the admins (AC-2.4)" do
      expect { join(code: circle.formatted_code) }.to have_enqueued_mail(CircleMailer, :request_received)
      expect(response).to have_http_status(:created)
      expect(circle.memberships.find_by(user: parent)).to be_pending
      get "/api/v1/circles/#{circle.id}", headers: auth_headers(parent)
      expect(response).to have_http_status(:not_found)
    end

    it "AC-2.4 groups further requests within the hour into one e-mail" do
      join(code: circle.formatted_code)
      expect { join({ code: circle.formatted_code }, create(:user)) }
        .to not_have_enqueued_mail(CircleMailer, :request_received)
        .and have_enqueued_job(DeliverCircleRequestDigestJob)
      travel 61.minutes do
        expect { perform_enqueued_jobs(only: DeliverCircleRequestDigestJob) }.to have_enqueued_mail(CircleMailer, :requests_digest)
      end
    end

    it "AC-2.7 a declined person is told so (PM 2026-10-07) and no request is created" do
      blocked = create(:circle_membership, circle: circle, user: parent, status: "declined")
      expect { join(token: circle.invite_token) }.not_to have_enqueued_mail(CircleMailer, :request_received)
      expect(response).to have_http_status(:forbidden)
      expect(json).to eq({ "error" => { "code" => "circle_request_declined",
                                        "message" => I18n.t("api.errors.circle_request_declined") } })
      expect(blocked.reload.status).to eq("declined")
    end

    it "AC-2.7 a removed person is told so (PM 2026-10-07) and nothing is created" do
      blocked = create(:circle_membership, circle: circle, user: parent, status: "removed")
      expect { join(code: circle.formatted_code) }.not_to have_enqueued_mail(CircleMailer, :request_received)
      expect(response).to have_http_status(:forbidden)
      expect(error_code).to eq("circle_membership_removed")
      expect(json["error"].keys).to eq(%w[code message])
      expect(blocked.reload.status).to eq("removed")
    end

    it "AC-2.9 refuses when the circle is full" do
      create_list(:circle_membership, 24, circle: circle)
      join(code: circle.formatted_code)
      expect(error_code).to eq("circle_full")
    end

    it "AC-3.4 refuses a sixth circle" do
      5.times { create(:circle_membership, user: parent) }
      join(code: circle.formatted_code)
      expect(error_code).to eq("circle_member_limit")
    end

    it "refuses a second request and an existing member" do
      join(code: circle.formatted_code)
      join(code: circle.formatted_code)
      expect(error_code).to eq("already_requested")
      join({ code: circle.formatted_code }, admin)
      expect(error_code).to eq("already_member")
    end

    it "AC-2.6 lets a person ask again after an expiry or a cancellation" do
      create(:circle_membership, circle: circle, user: parent, status: "expired")
      join(code: circle.formatted_code)
      expect(circle.memberships.find_by(user: parent)).to be_pending
    end
  end

  describe "POST /circles/:id/join_request (public page)" do
    let(:circle) { create(:circle, created_by: admin) }

    it "AC-17.6 creates a request for a public circle, always with approval" do
      post "/api/v1/circles/#{circle.id}/join_request", headers: auth_headers(create(:user, :verified))
      expect(response).to have_http_status(:created)
      expect(circle.memberships.pending.count).to eq(1)
    end

    it "AC-2.7 a declined or removed person asking from the page is told so; nothing is created" do
      { "declined" => "circle_request_declined", "removed" => "circle_membership_removed" }.each do |status, code|
        blocked = create(:circle_membership, circle: circle, status: status)
        expect { post "/api/v1/circles/#{circle.id}/join_request", headers: auth_headers(blocked.user) }
          .not_to have_enqueued_mail(CircleMailer, :request_received)
        expect(response).to have_http_status(:forbidden)
        expect(error_code).to eq(code)
        expect(blocked.reload.status).to eq(status)
      end
    end

    it "AC-4.6 can't target a private circle" do
      circle.update!(visibility: "private")
      post "/api/v1/circles/#{circle.id}/join_request", headers: auth_headers(parent)
      expect(response).to have_http_status(:not_found)
    end

    it "AC-17.4 the invitation still works for a public circle" do
      join(code: circle.formatted_code)
      expect(response).to have_http_status(:created)
    end
  end
end
