require "rails_helper"

RSpec.describe "Security rules", type: :request do
  it "AC-10.6 filters sensitive parameters from logs" do
    filter = ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters)
    filtered = filter.filter("email" => "a@b.c", "password" => "x", "last_name" => "D", "date_of_birth" => "1990-01-01",
                             "token" => "t", "city_shown" => "Lyon", "code" => "123456")

    expect(filtered.values_at("email", "password", "last_name", "date_of_birth", "token", "city_shown"))
      .to all(eq("[FILTERED]"))
  end

  it "AC-10.7 forces HTTPS in production" do
    production = Rails.root.join("config/environments/production.rb").read

    expect(production).to include("config.force_ssl = true", "config.assume_ssl = true")
  end

  describe "AC-7.14 AC-8.4 restricted actions" do
    controller = Class.new(Api::V1::BaseController) do
      before_action :require_verified!
      def create = render(json: { ok: true }, status: :created)
    end

    before do
      stub_const("RestrictedTestController", controller)
      Rails.application.routes.disable_clear_and_finalize = true
      Rails.application.routes.draw { post "/api/v1/restricted_test", to: "restricted_test#create" }
    end

    after { Rails.application.reload_routes! }

    it "refuses a parent without a valid verification, even through a direct API call" do
      post "/api/v1/restricted_test", headers: auth_headers(create(:user, :pending_verification))

      expect(response).to have_http_status(:forbidden)
      expect(error_code).to eq("verification_required")
      expect(json.dig("error", "message")).to eq(I18n.t("api.errors.verification_required", locale: :fr))
    end

    it "lets a verified parent through" do
      post "/api/v1/restricted_test", headers: auth_headers(create(:user, :verified))

      expect(response).to have_http_status(:created)
    end
  end
end
