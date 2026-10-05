require "rails_helper"

RSpec.describe Events::HostStatusSync do
  let(:host) { create(:user, :verified) }
  let!(:upcoming) { create(:event, host: host) }
  let!(:draft) { create(:event, :draft, host: host) }

  it "AC-8.2 suspends upcoming published events when the host's verification expires" do
    host.update!(verification_status: "expired")
    expect(upcoming.reload).to have_attributes(status: "suspended", suspension_reason: "host_unverified")
    expect(draft.reload).to be_draft
    expect(Event.listed).not_to include(upcoming)
  end

  it "AC-8.2 suspends on a name change that resets verification (AC-7.8)" do
    host.assign_attributes(first_name: "Clara")
    host.reset_verification_if_name_changed
    host.save!
    expect(upcoming.reload).to be_suspended
  end

  it "AC-8.3 resumes when the host is verified again before the start" do
    host.update!(verification_status: "expired")
    host.update!(verification_status: "verified", verification_expires_on: 1.year.from_now.to_date)
    expect(upcoming.reload).to have_attributes(status: "published", suspension_reason: nil)
  end

  it "AC-8.3 never resumes an event an admin suspended" do
    upcoming.suspend!("admin")
    host.update!(verification_status: "expired")
    host.update!(verification_status: "verified", verification_expires_on: 1.year.from_now.to_date)
    expect(upcoming.reload).to have_attributes(status: "suspended", suspension_reason: "admin")
  end

  it "AC-8.4 keeps events running while a renewal is pending (still verified)" do
    create(:verification, user: host, renewal: true)
    host.update!(verification_reminder_30_sent_at: Time.current)
    expect(host.reload).to be_renewal_pending
    expect(upcoming.reload).to be_published
  end

  it "AC-8.5 cancels upcoming events and frees taken places when the account closes" do
    other = create(:event)
    create(:event_participation, event: other, user: host, adults: 1, children: 2)
    Accounts::Closure.new(host).close!
    expect(upcoming.reload).to be_cancelled
    expect(other.reload.places_taken).to eq(0)
  end

  it "AC-8.6 removes a participant whose verification is revoked, but not one whose verification expires" do
    admin = create(:user, :admin)
    revoked = create(:user, :verified)
    expired = create(:user, :verified)
    other = create(:event, places_total: 10)
    create(:event_participation, event: other, user: revoked, adults: 2, children: 0)
    create(:event_participation, event: other, user: expired, adults: 1, children: 0)

    Verifications::Decision.new(admin: admin).revoke!(revoked, reason: Verification::REVOCATION_REASONS.first)
    expired.update!(verification_status: "expired")

    expect(other.participations.reload.map(&:user)).to eq([ expired ])
    expect(other.reload.places_taken).to eq(1)
  end
end
