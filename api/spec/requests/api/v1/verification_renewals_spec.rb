require "rails_helper"

RSpec.describe "AC-7.15 early renewal", type: :request do
  let(:old_expiry) { 20.days.from_now.to_date }
  let(:parent) { create(:user, :verified, verification_expires_on: old_expiry) }
  let(:headers) { auth_headers(parent) }
  let(:admin) { create(:user, :admin) }

  before do
    create(:verification, :approved, user: parent, decided_at: 700.days.ago)
    post "/api/v1/verification", params: { document_type: "passport", document_front: upload, selfie: upload,
                                           date_of_birth: "1990-01-01" }, headers: headers
  end

  it "keeps the parent verified and shows the renewal as pending" do
    expect(response).to have_http_status(:created)
    expect(parent.reload).to be_verified
    expect(json["verification"]).to include("status" => "verified", "verified" => true)
    expect(json.dig("verification", "renewal", "status")).to eq("pending")
    expect(parent.verifications.last).to be_renewal
  end

  it "applies the new expiry when the renewal is approved" do
    Verifications::Decision.new(admin: admin).approve!(parent.verifications.last, document_expires_on: 5.years.from_now.to_date)

    expect(parent.reload.verification_expires_on).to eq(2.years.from_now.to_date)
    get "/api/v1/verification", headers: headers
    expect(json.dig("verification", "renewal")).to be_nil
  end

  it "keeps the old verification and its expiry when the renewal is rejected, and allows a new try" do
    Verifications::Decision.new(admin: admin).reject!(parent.verifications.last, reason: "photo_blurry")

    expect(parent.reload).to be_verified
    expect(parent.verification_expires_on).to eq(old_expiry)
    get "/api/v1/verification", headers: headers
    expect(json.dig("verification", "renewal", "status")).to eq("rejected")
    expect(json.dig("verification", "renewal", "rejection", "reason")).to eq("photo_blurry")

    post "/api/v1/verification", params: { document_type: "passport", document_front: upload, selfie: upload,
                                           date_of_birth: "1990-01-01" }, headers: headers
    expect(response).to have_http_status(:created)
  end

  it "ends the verified rights when the old verification expires before the renewal is decided" do
    VerificationExpiryJob.perform_now(today: old_expiry)

    expect(parent.reload).not_to be_verified
    expect(parent.verification_status).to eq("pending")
  end

  it "still refuses a second renewal while one is pending (AC-7.5)" do
    post "/api/v1/verification", params: { document_type: "passport", document_front: upload, selfie: upload,
                                           date_of_birth: "1990-01-01" }, headers: headers
    expect(response).to have_http_status(:conflict)
  end
end
