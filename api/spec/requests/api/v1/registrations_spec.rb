require "rails_helper"

RSpec.describe "POST /api/v1/registrations", type: :request do
  let(:valid_params) do
    { user: { first_name: "Claire", last_name: "Martin", email: "claire@example.com", password: "correct-horse-battery",
              adult_confirmed: true, terms_accepted: true, marketing_opt_in: false, locale: "fr" } }
  end

  def sign_up(overrides = {})
    post "/api/v1/registrations", params: valid_params.deep_merge(user: overrides), as: :json
  end

  it "AC-1.1 creates an unconfirmed account and sends a confirmation email" do
    expect { sign_up }.to change(User, :count).by(1)
      .and have_enqueued_mail(AccountMailer, :confirmation_instructions)

    expect(response).to have_http_status(:accepted)
    expect(json).to eq("status" => "check_inbox")
    expect(User.last).not_to be_confirmed
  end

  it "AC-1.2 refuses the account when the 18+ box is not ticked and says which box" do
    expect { sign_up(adult_confirmed: false) }.not_to change(User, :count)

    expect(response).to have_http_status(:unprocessable_content)
    expect(error_code).to eq("validation_failed")
    expect(json.dig("error", "details")).to eq("adult_confirmed" => [ "must_be_accepted" ])
  end

  it "AC-1.2 refuses the account when the terms box is not ticked" do
    sign_up(terms_accepted: nil)

    expect(json.dig("error", "details")).to eq("terms_accepted" => [ "must_be_accepted" ])
  end

  it "AC-1.3 answers the same for an existing email, creates nothing and warns the owner" do
    owner = create(:user, email: "claire@example.com")

    expect { sign_up(email: "Claire@Example.com") }.to not_change(User, :count)
      .and have_enqueued_mail(AccountMailer, :registration_attempt).with(owner)

    expect(response).to have_http_status(:accepted)
    expect(json).to eq("status" => "check_inbox")
  end

  it "AC-1.4 refuses a password shorter than 10 characters" do
    sign_up(password: "short1")

    expect(json.dig("error", "details", "password")).to eq([ "too_short" ])
  end

  it "AC-1.4 refuses a commonly breached password" do
    sign_up(password: "motdepasse123")

    expect(json.dig("error", "details", "password")).to eq([ "too_common" ])
  end

  it "AC-1.5 gives only the parent role and not verified status, whatever is sent" do
    post "/api/v1/registrations", params: valid_params.deep_merge(user: { roles: [ "admin" ], verification_status: "verified" }),
                                  as: :json

    user = User.last
    expect(user.role_names).to eq([ "parent" ])
    expect(user.verification_status).to eq("not_verified")
  end

  it "AC-1.6 stores no other personal data than the sign-up fields" do
    post "/api/v1/registrations", params: valid_params.deep_merge(user: { city_shown: "Lyon", date_of_birth: "1990-01-01" }),
                                  as: :json

    expect(User.last).to have_attributes(city_shown: nil, date_of_birth: nil)
  end

  it "AC-5.2 records the accepted terms and privacy versions and when" do
    sign_up

    expect(User.last).to have_attributes(terms_version: "1.0", privacy_version: "1.0",
                                         terms_accepted_at: be_within(5.seconds).of(Time.current))
  end

  it "AC-5.3 keeps marketing optional and off by default" do
    sign_up(marketing_opt_in: nil)

    expect(response).to have_http_status(:accepted)
    expect(User.last.marketing_opt_in).to be(false)
  end

  it "rejects an invalid email format" do
    sign_up(email: "claire@")

    expect(json.dig("error", "details", "email")).to eq([ "invalid" ])
  end

  it "returns 400 when the user object is missing" do
    post "/api/v1/registrations", params: {}, as: :json

    expect(response).to have_http_status(:bad_request)
  end
end
