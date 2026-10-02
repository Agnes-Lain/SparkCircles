require "rails_helper"

RSpec.describe VerificationExpiryJob do
  let(:user) { create(:user, verification_status: "verified", verification_expires_on: Date.current + 30) }

  it "AC-7.12 reminds the parent 30 days and then 7 days before expiry, once each" do
    user
    expect { described_class.perform_now }.to have_enqueued_mail(AccountMailer, :verification_expiring).with(user, 30)
    expect { described_class.perform_now }.not_to have_enqueued_mail(AccountMailer, :verification_expiring)

    expect { described_class.perform_now(today: Date.current + 23) }
      .to have_enqueued_mail(AccountMailer, :verification_expiring).with(user, 7)
  end

  it "AC-7.13 marks the verification expired on its expiry date and tells the parent" do
    user
    expect { described_class.perform_now(today: Date.current + 30) }
      .to have_enqueued_mail(AccountMailer, :verification_expired).with(user)

    expect(user.reload.verification_status).to eq("expired")
  end
end
