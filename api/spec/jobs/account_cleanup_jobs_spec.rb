require "rails_helper"

RSpec.describe "Account cleanup jobs" do
  describe PurgeUnconfirmedAccountsJob do
    it "AC-2.4 deletes accounts unconfirmed 7 days after sign-up, freeing the email" do
      stale = create(:user, :unconfirmed, email: "stale@example.com", created_at: 8.days.ago)
      recent = create(:user, :unconfirmed, created_at: 6.days.ago)
      confirmed = create(:user, created_at: 30.days.ago)

      described_class.perform_now

      expect(User.exists?(stale.id)).to be(false)
      expect(User.exists?(recent.id)).to be(true)
      expect(User.exists?(confirmed.id)).to be(true)
      expect(build(:user, email: "stale@example.com")).to be_valid
    end
  end

  describe EraseClosedAccountsJob do
    let(:user) { create(:user, :verified, email: "leaving@example.com", created_at: Time.zone.local(2026, 3, 14), closed_at: 31.days.ago) }

    before do
      create(:verification, :approved, user: user)
      user.issue_token!
      user.data_exports.create!(requested_at: 40.days.ago)
      AuditEvent.record!(action: "viewed_member", subject: user, reason: "user_request")
    end

    it "AC-11.4 erases all personal data at the end of the grace period, files included" do
      blob_ids = user.verifications.flat_map { |v| [ v.document_front, v.selfie ] }.map { |file| file.blob.id }

      described_class.perform_now

      expect(User.exists?(user.id)).to be(false)
      expect(Verification.where(user_id: user.id)).to be_empty
      expect(AllowlistedJwt.where(user_id: user.id)).to be_empty
      expect(Role.where(user_id: user.id)).to be_empty
      expect(ActiveStorage::Blob.where(id: blob_ids)).to be_empty
    end

    it "AC-11.5 AC-11.6 keeps only a non-identifying statistic" do
      expect { described_class.perform_now }.to change(ClosedAccountStatistic, :count).by(1)

      stat = ClosedAccountStatistic.last
      expect(stat.attributes.keys).to contain_exactly("id", "signup_month", "closure_month", "was_verified")
      expect(stat).to have_attributes(signup_month: Date.new(2026, 3, 1), was_verified: true)
    end

    it "AC-11.6 leaves audit entries that no longer link to any personal data" do
      described_class.perform_now

      entry = AuditEvent.find_by(subject_user_id: user.id)
      expect(entry).to be_present
      expect(User.exists?(entry.subject_user_id)).to be(false)
    end

    it "AC-11.8 lets someone sign up again with the email, with nothing from the old account" do
      described_class.perform_now

      fresh = create(:user, email: "leaving@example.com")
      expect(fresh.verification_status).to eq("not_verified")
      expect(fresh.verifications).to be_empty
    end

    it "AC-11.3 keeps accounts still in the grace period" do
      recent = create(:user, closed_at: 29.days.ago)

      described_class.perform_now
      expect(User.exists?(recent.id)).to be(true)
    end
  end

  describe PurgeStaleTokensJob do
    it "AC-3.4 deletes device tokens unused for 30 days" do
      user = create(:user)
      user.issue_token!(device_name: "old phone")
      travel 31.days do
        user.issue_token!(device_name: "new phone")
        described_class.perform_now
        expect(user.allowlisted_jwts.pluck(:device_name)).to eq([ "new phone" ])
      end
    end
  end

  describe ExpireDataExportsJob do
    it "AC-12.2 deletes the file after 7 days and keeps the request record (AC-12.3)" do
      export = create(:user).data_exports.create!(requested_at: Time.current)
      BuildDataExportJob.perform_now(export)

      travel 8.days do
        described_class.perform_now
        expect(export.reload).to be_expired
        expect(export.file).not_to be_attached
        expect(export.delivered_at).to be_present
      end
    end
  end
end
