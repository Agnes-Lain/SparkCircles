require "rails_helper"

RSpec.describe "Copy of my data", type: :request do
  let(:user) { create(:user, city_shown: "Lyon") }
  let(:headers) { auth_headers(user) }

  it "AC-12.1 AC-12.3 records the request and delivers a machine-readable file" do
    freeze_time do
      expect { post "/api/v1/data_export", headers: headers }.to have_enqueued_job(BuildDataExportJob)
      expect(response).to have_http_status(:accepted)
      expect(json.dig("data_export", "status")).to eq("pending")
      expect(user.data_exports.last.requested_at).to eq(Time.current)
    end

    expect { perform_enqueued_jobs(only: BuildDataExportJob) }.to have_enqueued_mail(AccountMailer, :data_export_ready)

    get "/api/v1/data_export", headers: headers
    expect(json.dig("data_export", "status")).to eq("ready")
    expect(json.dig("data_export", "delivered_at")).to be_present

    get "/api/v1/data_export/download", headers: headers
    expect(response).to have_http_status(:ok)
    expect(response.headers["Cache-Control"]).to include("no-store")
    data = JSON.parse(response.body)
    expect(data.keys).to include("account", "profile", "consents", "verification", "data_copy_requests")
    expect(data.dig("account", "email")).to eq(user.email)
    expect(data.dig("profile", "city_shown")).to eq("Lyon")
  end

  it "AC-12.2 only lets the logged-in owner download, for 7 days" do
    post "/api/v1/data_export", headers: headers
    perform_enqueued_jobs(only: BuildDataExportJob)

    get "/api/v1/data_export/download"
    expect(response).to have_http_status(:unauthorized)

    get "/api/v1/data_export/download", headers: auth_headers(create(:user))
    expect(response).to have_http_status(:not_found)

    travel 8.days do
      get "/api/v1/data_export/download", headers: auth_headers(user)
      expect(response).to have_http_status(:not_found)
      get "/api/v1/data_export", headers: auth_headers(user)
      expect(json.dig("data_export", "status")).to eq("expired")
    end
  end

  it "returns the pending request instead of creating another" do
    post "/api/v1/data_export", headers: headers
    expect { post "/api/v1/data_export", headers: headers }.not_to change(DataExport, :count)
  end
end
