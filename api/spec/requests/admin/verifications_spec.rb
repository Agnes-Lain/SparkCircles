require "rails_helper"

RSpec.describe "Back office verification review", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:parent) { create(:user, :pending_verification, first_name: "Thomas", last_name: "Renard", date_of_birth: Date.new(1988, 3, 14)) }
  let!(:verification) { create(:verification, user: parent, submitted_at: 31.hours.ago) }

  before { admin_log_in(admin) }

  describe "W1 queue" do
    it "AC-9.1 lists pending verifications oldest first with the waiting time" do
      newer = create(:verification, user: create(:user, first_name: "Anna"), submitted_at: 2.hours.ago)

      get "/admin/verifications"

      expect(response).to have_http_status(:ok)
      expect(response.body.index("Thomas R.")).to be < response.body.index("Anna M.")
      expect(response.body).to include("31 h", "Over 24 h", newer.user.display_name)
    end

    it "AC-9.3 shows the admin's own verification without a review action" do
      create(:verification, user: admin, submitted_at: 40.hours.ago)

      get "/admin/verifications"

      expect(response.body).to include("Your own verification. Another admin reviews it.")
    end

    it "shows the empty state" do
      verification.update!(status: "rejected", decided_at: Time.current, rejection_reason: "photo_blurry")

      get "/admin/verifications"
      expect(response.body).to include("All caught up")
    end
  end

  describe "W2 review" do
    it "AC-9.2 AC-10.4 shows document, selfie, date of birth and name, and records the access" do
      expect { get "/admin/verifications/#{verification.id}" }.to change(AuditEvent, :count).by(1)

      expect(response.body).to include("Thomas Renard", "14 Mar 1988", "National ID card", "Your access is recorded")
      expect(AuditEvent.last).to have_attributes(
        action: "viewed_verification", actor_id: admin.id, subject_user_id: parent.id, reason: "verification_review",
        fields: %w[document_images selfie date_of_birth full_name]
      )
      expect(response.headers["Cache-Control"]).to include("no-store")
    end

    it "AC-10.2 streams decrypted images only after an audited review was opened" do
      get "/admin/verifications/#{verification.id}/files/selfie"
      expect(response).to have_http_status(:forbidden)

      get "/admin/verifications/#{verification.id}"
      get "/admin/verifications/#{verification.id}/files/selfie"
      expect(response).to have_http_status(:ok)
      expect(response.body.b).to eq(file_fixture("photo.jpg").binread)
      expect(response.media_type).to eq("image/jpeg")
    end

    it "AC-9.3 refuses to open the admin's own verification" do
      own = create(:verification, user: admin)

      get "/admin/verifications/#{own.id}"
      expect(response).to have_http_status(:forbidden)

      post "/admin/verifications/#{own.id}/approve", params: { document_expires_on: 3.years.from_now.to_date.iso8601 }
      expect(response).to have_http_status(:forbidden)
      expect(own.reload).to be_pending
    end
  end

  describe "approve" do
    it "AC-7.6 AC-7.11 verifies the parent until the document expiry when it comes first, and emails them" do
      expiry = 1.year.from_now.to_date

      expect do
        post "/admin/verifications/#{verification.id}/approve", params: { document_expires_on: expiry.iso8601 }
      end.to have_enqueued_mail(AccountMailer, :verification_approved)

      expect(response).to redirect_to("/admin/verifications")
      expect(parent.reload).to be_verified
      expect(parent.verification_expires_on).to eq(expiry)
      expect(verification.reload).to have_attributes(status: "approved", reviewer_id: admin.id, document_expires_on: expiry)
      expect(AuditEvent.last.action).to eq("approved_verification")
    end

    it "AC-7.11 caps the validity at 2 years" do
      post "/admin/verifications/#{verification.id}/approve", params: { document_expires_on: 8.years.from_now.to_date.iso8601 }

      expect(parent.reload.verification_expires_on).to eq(2.years.from_now.to_date)
    end

    it "AC-7.4 refuses an expired document" do
      post "/admin/verifications/#{verification.id}/approve", params: { document_expires_on: 1.day.ago.to_date.iso8601 }

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.body).to include("This document has expired")
      expect(parent.reload).not_to be_verified
    end
  end

  describe "W3 reject" do
    it "AC-7.7 rejects with a reason and an optional note, and emails the parent" do
      expect do
        post "/admin/verifications/#{verification.id}/reject", params: { rejection_reason: "photo_blurry", note: "Use daylight" }
      end.to have_enqueued_mail(AccountMailer, :verification_rejected)

      expect(parent.reload.verification_status).to eq("rejected")
      expect(verification.reload).to have_attributes(status: "rejected", rejection_reason: "photo_blurry", note: "Use daylight")
    end

    it "requires a reason from the list" do
      post "/admin/verifications/#{verification.id}/reject", params: { rejection_reason: "because" }

      expect(response).to have_http_status(:unprocessable_content)
      expect(verification.reload).to be_pending
    end
  end

  it "AC-7.10 keeps the images available to admins for 30 days after the decision, then erases them" do
    post "/admin/verifications/#{verification.id}/reject", params: { rejection_reason: "photo_blurry" }

    travel 29.days do
      PurgeVerificationFilesJob.perform_now
      expect(verification.reload.selfie).to be_attached
    end
    travel 31.days do
      PurgeVerificationFilesJob.perform_now
      verification.reload
      expect([ verification.document_front, verification.document_back, verification.selfie ]).to all(satisfy { |file| !file.attached? })
      expect(verification).to have_attributes(status: "rejected", document_type: "national_id_card", reviewer_id: admin.id)
      expect(verification.decided_at).to be_present
    end
  end
end
