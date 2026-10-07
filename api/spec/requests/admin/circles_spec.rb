require "rails_helper"

RSpec.describe "Back office reported circles", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:circle) { create(:circle, name: "Cercle signalé") }

  before do
    CircleReport.create!(circle: circle, reporter: create(:user), reason: "unsafe", details: "Nom bizarre")
    admin_log_in(admin)
  end

  it "AC-7.2 lists reported circles and shows the reports, audited" do
    get "/admin/circles"
    expect(response.body).to include("Cercle signalé", "Unsafe or inappropriate")
    expect { get "/admin/circles/#{circle.id}" }.to change(AuditEvent, :count).by(1)
    expect(response.body).to include("Nom bizarre")
    expect(AuditEvent.last).to have_attributes(action: "viewed_circle", reason: "safety_report")
  end

  it "AC-7.3 pauses and resumes a circle; reports are marked reviewed" do
    post "/admin/circles/#{circle.id}/suspend"
    expect(circle.reload).to be_suspended
    expect(CircleReport.open.count).to eq(0)
    post "/admin/circles/#{circle.id}/resume"
    expect(circle.reload).to be_active
  end

  it "AC-17.7 forces a public circle to private" do
    post "/admin/circles/#{circle.id}/force_private"
    expect(circle.reload).to be_private
    expect(AuditEvent.last.action).to eq("circle_forced_private")
  end

  it "is closed to non-admins" do
    delete "/admin/logout"
    get "/admin/circles"
    expect(response).to redirect_to("/admin/login")
  end
end
