require "rails_helper"

RSpec.describe "Back office members", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:member) { create(:user, :verified, email: "member@example.com") }

  before { admin_log_in(admin) }

  describe "W4 search" do
    it "AC-10.4 requires a reason and records the search" do
      member
      post "/admin/members/search", params: { email: "member@example.com" }
      expect(response).to have_http_status(:unprocessable_content)

      expect do
        post "/admin/members/search", params: { email: "member@example.com", reason: "user_request" }
      end.to change(AuditEvent, :count).by(1)
      expect(response).to redirect_to("/admin/members/#{member.id}?reason=user_request")
      expect(AuditEvent.last).to have_attributes(action: "searched_member", reason: "user_request", subject_user_id: member.id)
    end
  end

  describe "W5 member detail" do
    it "AC-10.4 asks for a reason, then shows the data and records the access" do
      get "/admin/members/#{member.id}"
      expect(response.body).to include("Before you open this member")

      expect { get "/admin/members/#{member.id}", params: { reason: "safety_report" } }.to change(AuditEvent, :count).by(1)
      expect(response.body).to include("member@example.com", "Martin", "Verified ✓")
      expect(AuditEvent.last).to have_attributes(action: "viewed_member", subject_user_id: member.id, reason: "safety_report")
    end

    it "AC-7.9 removes a verification with a reason and informs the member" do
      create(:verification, :approved, user: member)

      expect do
        post "/admin/members/#{member.id}/revoke_verification", params: { revocation_reason: "safety_report", note: "Reported" }
      end.to have_enqueued_mail(AccountMailer, :verification_revoked)

      expect(member.reload).not_to be_verified
      expect(member.verification_status).to eq("not_verified")
      expect(member.latest_verification).to have_attributes(revocation_reason: "safety_report", revoked_by_id: admin.id)
    end

    it "AC-8.5 a revoked member is refused restricted actions at once, with the same token" do
      headers = auth_headers(member)
      expect(member.verified?).to be(true)

      post "/admin/members/#{member.id}/revoke_verification", params: { revocation_reason: "other" }

      get "/api/v1/me", headers: headers
      expect(json.dig("verification", "verified")).to be(false)
    end

    it "AC-1.7 AC-9.6 gives and removes the admin role on the same account, audited" do
      member
      expect { post "/admin/members/#{member.id}/grant_admin" }.not_to change(User, :count)
      expect(member.reload.role_names).to eq(%w[admin parent])
      expect(AuditEvent.last).to have_attributes(action: "granted_admin_role", actor_id: admin.id)

      post "/admin/members/#{member.id}/remove_admin"
      expect(member.reload.role_names).to eq(%w[parent])
      expect(AuditEvent.last.action).to eq("removed_admin_role")
    end

    it "AC-9.6 an admin can't change their own admin role" do
      post "/admin/members/#{admin.id}/remove_admin"

      expect(response).to have_http_status(:forbidden)
      expect(admin.reload).to be_admin
    end

    it "AC-13.8 restores the previous email after a report and sends a reset link" do
      member.update!(email: "attacker@example.com", security_locked_at: Time.current)
      report = create(:email_change, user: member, previous_email: "member@example.com", new_email: "attacker@example.com",
                                     reported_at: Time.current)

      get "/admin/members", params: {}
      expect(response.body).to include(member.display_name)

      expect do
        post "/admin/members/#{member.id}/restore_email", params: { email_change_id: report.id }
      end.to have_enqueued_job(DeviseNotificationJob).with(anything, "reset_password_instructions")

      expect(member.reload).to have_attributes(email: "member@example.com", security_locked_at: nil)
      expect(report.reload.restored_at).to be_present
      expect(AuditEvent.last.action).to eq("restored_email")
    end
  end
end
