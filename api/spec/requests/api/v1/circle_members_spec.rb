require "rails_helper"

RSpec.describe "Circle requests, members and admins", type: :request do
  let(:admin) { create(:user, :verified, first_name: "Claire") }
  let(:circle) { create(:circle, created_by: admin) }

  def member(user = create(:user, :verified), **attributes)
    create(:circle_membership, circle: circle, user: user, **attributes)
  end

  describe "requests" do
    let(:request_row) { member(create(:user), status: "pending", requested_at: Time.current) }

    it "AC-2.5 accepting makes a member and e-mails « You're in », audited" do
      expect { post "/api/v1/circles/#{circle.id}/requests/#{request_row.id}/accept", headers: auth_headers(admin) }
        .to have_enqueued_mail(CircleMailer, :request_accepted)
      expect(json.dig("circle", "families_count")).to eq(2)
      expect(request_row.reload).to be_active
      expect(AuditEvent.last.action).to eq("circle_member_joined")
    end

    it "AC-2.5 declining is neutral and final" do
      expect { post "/api/v1/circles/#{circle.id}/requests/#{request_row.id}/decline", headers: auth_headers(admin) }
        .to have_enqueued_mail(CircleMailer, :request_declined)
      post "/api/v1/circles/#{circle.id}/requests/#{request_row.id}/accept", headers: auth_headers(admin)
      expect(error_code).to eq("request_not_pending")
    end

    it "AC-2.9 can't accept when the circle has 25 families" do
      create_list(:circle_membership, 24, circle: circle)
      post "/api/v1/circles/#{circle.id}/requests/#{request_row.id}/accept", headers: auth_headers(admin)
      expect(error_code).to eq("circle_full")
    end

    it "AC-6.5 an admin whose verification lapsed can't decide" do
      admin.update!(verification_status: "expired")
      post "/api/v1/circles/#{circle.id}/requests/#{request_row.id}/accept", headers: auth_headers(admin)
      expect(error_code).to eq("admin_rights_paused")
    end

    it "AC-2.6 expires after 30 days and tells the person they can ask again" do
      request_row.update!(requested_at: 31.days.ago)
      expect { ExpireCircleRequestsJob.perform_now }.to have_enqueued_mail(CircleMailer, :request_expired)
      expect(request_row.reload.status).to eq("expired")
    end
  end

  describe "leave" do
    it "AC-5.1 a member leaves at once and loses access" do
      row = member
      delete "/api/v1/circles/#{circle.id}/membership", headers: auth_headers(row.user)
      expect(response).to have_http_status(:no_content)
      expect(row.reload.status).to eq("left")
      get "/api/v1/circles/#{circle.id}", headers: auth_headers(row.user)
      expect(json.dig("circle", "audience")).to eq("public")
    end

    it "AC-6.2 the sole admin must name another admin first" do
      member
      delete "/api/v1/circles/#{circle.id}/membership", headers: auth_headers(admin)
      expect(error_code).to eq("sole_admin")
    end

    it "the last member leaving deletes the circle" do
      delete "/api/v1/circles/#{circle.id}/membership", headers: auth_headers(admin)
      expect(Circle.exists?(circle.id)).to be(false)
    end
  end

  describe "remove" do
    it "AC-5.2, AC-5.5 removes a member at once, blocks them and keeps an audit entry" do
      row = member
      delete "/api/v1/circles/#{circle.id}/members/#{row.id}", headers: auth_headers(admin)
      expect(json.dig("circle", "families_count")).to eq(1)
      expect(row.reload.status).to eq("removed")
      expect(AuditEvent.last).to have_attributes(action: "circle_member_removed", actor_id: admin.id, subject_user_id: row.user_id)
      post "/api/v1/circle_invitations/join", params: { code: circle.formatted_code }, headers: auth_headers(row.user), as: :json
      expect(response).to have_http_status(:created)
      expect(row.reload.status).to eq("removed")
    end

    it "AC-5.3 can't remove an admin or the creator" do
      co = member(role: "admin", admin_since: Time.current)
      delete "/api/v1/circles/#{circle.id}/members/#{co.id}", headers: auth_headers(admin)
      expect(error_code).to eq("member_is_admin")
      delete "/api/v1/circles/#{circle.id}/members/#{circle.memberships.find_by(user: admin).id}", headers: auth_headers(co.user)
      expect(error_code).to eq("member_is_creator")
    end

    it "a member can't remove anyone" do
      row = member
      delete "/api/v1/circles/#{circle.id}/members/#{member.id}", headers: auth_headers(row.user)
      expect(error_code).to eq("forbidden")
    end
  end

  describe "admins" do
    it "AC-6.1 promotes a verified member to co-admin, 3 admins at most" do
      row = member
      post "/api/v1/circles/#{circle.id}/members/#{row.id}/promote", headers: auth_headers(admin)
      expect(json.dig("circle", "members").find { |m| m["id"] == row.id }["role"]).to eq("co_admin")
      member(role: "admin", admin_since: Time.current)
      post "/api/v1/circles/#{circle.id}/members/#{member.id}/promote", headers: auth_headers(admin)
      expect(error_code).to eq("admin_limit")
    end

    it "AC-6.1 refuses to promote a member who isn't verified" do
      row = member(create(:user))
      post "/api/v1/circles/#{circle.id}/members/#{row.id}/promote", headers: auth_headers(admin)
      expect(error_code).to eq("not_verified_member")
    end

    it "AC-6.3 an admin steps down only if another admin exists; the creator hands over this way" do
      post "/api/v1/circles/#{circle.id}/membership/step_down", headers: auth_headers(admin)
      expect(error_code).to eq("sole_admin")
      co = member(role: "admin", admin_since: Time.current)
      post "/api/v1/circles/#{circle.id}/membership/step_down", headers: auth_headers(admin)
      expect(json.dig("circle", "my_role")).to eq("member")
      expect(co.reload).to have_attributes(role: "admin", creator: true)
      delete "/api/v1/circles/#{circle.id}/membership", headers: auth_headers(admin)
      expect(response).to have_http_status(:no_content)
    end
  end

  describe "reports" do
    it "AC-7.1, AC-7.2, AC-7.4 a member reports the circle or a member; only SparkCircles sees it" do
      reporter = member
      target = member
      post "/api/v1/circles/#{circle.id}/reports", params: { reason: "unsafe", details: "Bizarre" }, headers: auth_headers(reporter.user), as: :json
      expect(response).to have_http_status(:created)
      post "/api/v1/circles/#{circle.id}/reports", params: { reason: "child_safety", member_id: target.id },
                                                   headers: auth_headers(reporter.user), as: :json
      expect(CircleReport.last).to have_attributes(reported_user_id: target.user_id, reason: "child_safety")
      get "/api/v1/circles/#{circle.id}", headers: auth_headers(admin)
      expect(response.body).not_to include("Bizarre", "child_safety")
    end

    it "refuses a reason of the other list" do
      post "/api/v1/circles/#{circle.id}/reports", params: { reason: "child_safety" }, headers: auth_headers(member.user), as: :json
      expect(json.dig("error", "details", "reason")).to eq([ "inclusion" ])
    end

    it "AC-17.7 anyone who sees a public circle's page can report it, not a private one" do
      post "/api/v1/circles/#{circle.id}/reports", params: { reason: "not_real_group" }, headers: auth_headers(create(:user)), as: :json
      expect(response).to have_http_status(:created)
      circle.update!(visibility: "private")
      post "/api/v1/circles/#{circle.id}/reports", params: { reason: "other" }, headers: auth_headers(create(:user)), as: :json
      expect(response).to have_http_status(:not_found)
    end
  end
end
