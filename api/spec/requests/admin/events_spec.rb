require "rails_helper"

RSpec.describe "Back office reported events", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:event) { create(:event, tags: %w[foot prenom-lea]) }

  def report(target, reason: "inappropriate_tag")
    EventReport.create!(event: target, reporter: create(:user), reason: reason, details: "Un prénom d'enfant")
  end

  before { admin_log_in(admin) }

  it "AC-9.2 lists reported events with their reasons, and flags urgent ones (AC-9.4)" do
    calm = create(:event, title: "Lecture au parc")
    report(calm, reason: "other")
    3.times { report(event) }
    get "/admin/events"
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Inappropriate tag (3)", "Urgent", "Lecture au parc")
    expect(response.body.index(event.title)).to be < response.body.index("Lecture au parc")
  end

  it "records an audited access when viewing an event" do
    report(event)
    expect { get "/admin/events/#{event.id}" }.to change(AuditEvent, :count).by(1)
    expect(response.body).to include("Un prénom d&#39;enfant", event.exact_address)
    expect(AuditEvent.last).to have_attributes(action: "viewed_event", reason: "safety_report", subject_user_id: event.host_id,
                                               metadata: { "event_id" => event.id })
  end

  it "AC-3.11 removes a tag, audited" do
    post "/admin/events/#{event.id}/remove_tag", params: { tag: "prenom-lea" }
    expect(event.reload.tags).to eq(%w[foot])
    expect(AuditEvent.last).to have_attributes(action: "removed_event_tag", metadata: { "event_id" => event.id, "tag" => "prenom-lea" })
  end

  it "AC-9.3 suspends an event: hidden, not joinable, reports reviewed, audited" do
    report(event)
    post "/admin/events/#{event.id}/suspend"
    expect(event.reload).to have_attributes(status: "suspended", suspension_reason: "admin")
    expect(event.reports.open).to be_empty
    expect(AuditEvent.last.action).to eq("suspended_event")
    expect(Event.listed).not_to include(event)
  end

  it "cancels an event, audited" do
    post "/admin/events/#{event.id}/cancel"
    expect(event.reload).to be_cancelled
    expect(AuditEvent.last.action).to eq("cancelled_event")
  end

  it "marks reports as reviewed without touching the event" do
    report(event)
    post "/admin/events/#{event.id}/resolve_reports"
    expect(event.reports.open).to be_empty
    expect(event.reload).to be_published
    expect(AuditEvent.last).to have_attributes(action: "resolved_event_reports", metadata: { "event_id" => event.id, "reports" => 1 })
  end

  it "refuses non-admins and mobile tokens" do
    delete "/admin/logout"
    get "/admin/events"
    expect(response).to redirect_to("/admin/login")
    get "/admin/events", headers: auth_headers(admin)
    expect(response).to have_http_status(:forbidden)
  end
end
