require "rails_helper"

RSpec.describe "Identity verification", type: :request do
  let(:user) { create(:user) }
  let(:headers) { auth_headers(user) }
  let(:valid_params) do
    { document_type: "national_id_card", document_front: upload, document_back: upload, selfie: upload("photo.png", "image/png"),
      date_of_birth: "1988-03-14" }
  end

  def submit(params = valid_params)
    post "/api/v1/verification", params: params, headers: headers
  end

  describe "POST /api/v1/verification" do
    it "AC-7.3 sets the status to pending with the document, selfie and date of birth" do
      submit

      expect(response).to have_http_status(:created)
      expect(json.dig("verification", "status")).to eq("pending")
      verification = user.verifications.last
      expect(verification).to have_attributes(document_type: "national_id_card", status: "pending")
      expect([ verification.document_front, verification.document_back, verification.selfie ]).to all(be_attached)
      expect(user.reload.date_of_birth).to eq(Date.new(1988, 3, 14))
    end

    it "AC-10.2 stores the images encrypted, readable only through the app" do
      submit

      verification = user.verifications.last
      stored = verification.document_front.download
      original = file_fixture("photo.jpg").binread
      expect(stored).not_to include(original.byteslice(0, 20))
      expect(verification.document_front.content_type).to eq("application/octet-stream")
      expect(verification.read_encrypted(:document_front)).to eq(original)
    end

    it "AC-7.3 needs only the front for a passport" do
      submit(valid_params.except(:document_back).merge(document_type: "passport"))

      expect(response).to have_http_status(:created)
    end

    it "AC-7.3 needs the back of a two-sided document" do
      submit(valid_params.except(:document_back))

      expect(json.dig("error", "details", "document_back")).to eq([ "blank" ])
    end

    it "AC-7.5 refuses a second verification while one is pending" do
      submit
      submit

      expect(response).to have_http_status(:conflict)
      expect(error_code).to eq("verification_pending")
      expect(user.verifications.count).to eq(1)
    end

    it "refuses files that are not images, whatever their declared type" do
      submit(valid_params.merge(selfie: upload("not_an_image.jpg", "image/jpeg")))

      expect(json.dig("error", "details", "selfie")).to eq([ "invalid_type" ])
    end

    it "refuses an invalid date of birth or a minor" do
      submit(valid_params.merge(date_of_birth: 10.years.ago.to_date.iso8601))

      expect(json.dig("error", "details", "date_of_birth")).to eq([ "invalid" ])
    end

    it "lets a rejected parent submit again (AC-7.7)" do
      create(:verification, :rejected, user: user)
      user.update!(verification_status: "rejected")

      submit
      expect(response).to have_http_status(:created)
    end
  end

  describe "GET /api/v1/verification" do
    it "AC-7.7 shows the rejection reason in plain words" do
      create(:verification, :rejected, user: user, note: "Use daylight")
      user.update!(verification_status: "rejected")

      get "/api/v1/verification", headers: headers.merge("Accept-Language" => "en")

      expect(json.dig("verification", "rejection")).to eq(
        "reason" => "photo_blurry", "message" => "The photo is blurry. Take a new one in good light.", "note" => "Use daylight"
      )
    end

    it "AC-7.11 AC-7.12 shows the expiry date and flags it 30 days before" do
      user.update!(verification_status: "verified", verification_expires_on: 20.days.from_now.to_date)

      get "/api/v1/verification", headers: headers

      expect(json["verification"]).to include("verified" => true, "expires_soon" => true,
                                              "expires_on" => 20.days.from_now.to_date.iso8601)
    end

    it "AC-7.9 tells the parent their verification was removed, with the reason" do
      create(:verification, :approved, user: user, revoked_at: Time.current, revocation_reason: "safety_report",
                                       revocation_note: "Reported by a family")

      get "/api/v1/verification", headers: headers

      expect(json["verification"]).to include("status" => "not_verified", "revoked" => true)
      expect(json.dig("verification", "rejection", "note")).to eq("Reported by a family")
      expect(json.dig("verification", "rejection", "message")).to be_present # BUG-12
    end
  end

  it "AC-7.2 lets a parent who is not verified use everything that doesn't need verification" do
    other = create(:user)

    get "/api/v1/users/#{other.id}", headers: headers
    expect(response).to have_http_status(:ok)
    get "/api/v1/me", headers: headers
    expect(response).to have_http_status(:ok)
  end
end
