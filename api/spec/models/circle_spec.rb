require "rails_helper"

RSpec.describe Circle do
  def circle(**attributes) = build(:circle, **attributes)

  def error_keys(record, field)
    record.validate
    record.errors.details[field].map { |detail| detail[:error] }
  end

  it "AC-1.1 needs a name of 3 to 50 characters and an area from the Events list" do
    expect(error_keys(circle(name: "ab"), :name)).to include(:too_short)
    expect(error_keys(circle(name: "a" * 51), :name)).to include(:too_long)
    expect(error_keys(circle(area: "lyon-01"), :area)).to include(:inclusion)
    expect(error_keys(circle(description: "a" * 201), :description)).to include(:too_long)
    expect(circle).to be_valid
  end

  it "AC-1.3 refuses e-mail addresses, phone numbers and links in the name and description" do
    expect(error_keys(circle(description: "Écris à lea@example.com"), :description)).to eq([ :contains_email ])
    expect(error_keys(circle(description: "Appelle le 06 12 34 56 78"), :description)).to eq([ :contains_phone ])
    expect(error_keys(circle(description: "Tout sur parents-jaures.fr"), :description)).to eq([ :contains_link ])
    expect(error_keys(circle(name: "www.parents.com"), :name)).to eq([ :contains_link ])
    expect(circle(description: "La classe de CE2 2026, rue des écoles")).to be_valid
  end

  it "AC-17.7 refuses banned words in a public circle only" do
    expect(error_keys(circle(name: "Parents sexy"), :name)).to eq([ :banned_word ])
    expect(circle(name: "Parents sexy", visibility: "private")).to be_valid
  end

  it "PM 2026-10-07: public by default; a private circle carries the test-phase entitlement" do
    expect(described_class.new.visibility).to eq("public")
    created = create(:circle, :private)
    expect(created.premium_entitlement).to eq("test_phase_free")
    created.update!(visibility: "public")
    expect(created.premium_entitlement).to be_nil
    expect(created.visibility_changed_at).to be_present
  end

  it "AC-2.1 gets an unguessable link token and an 8-character code, stored with a keyed digest" do
    created = create(:circle)
    expect(created.invite_token.length).to be >= 22
    expect(created.formatted_code).to match(/\A[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}\z/)
    expect(created.invite_token_digest).not_to include(created.invite_token)
    expect(described_class.find_by_invitation(code: created.formatted_code.downcase.tr("-", " "))).to eq(created)
    expect(described_class.find_by_invitation(token: created.invite_token)).to eq(created)
  end

  it "AC-2.2 renewing replaces both the link and the code" do
    created = create(:circle)
    old_token = created.invite_token
    old_code = created.invite_code
    created.renew_invitation!
    expect(described_class.find_by_invitation(token: old_token)).to be_nil
    expect(described_class.find_by_invitation(code: old_code)).to be_nil
  end

  it "AC-6.5, AC-17.2 is discoverable only while an admin is verified" do
    created = create(:circle)
    expect(created).to be_discoverable
    created.created_by.update!(verification_status: "expired")
    expect(created.reload).not_to be_discoverable
    expect(created).not_to be_accepting_requests
  end

  it "AC-4.5 counts families without closed accounts and is full at 25" do
    created = create(:circle)
    create(:circle_membership, circle: created, user: create(:user, :closed))
    expect(created.families_count).to eq(1)
    create_list(:circle_membership, 24, circle: created)
    expect(created).to be_full
  end
end
