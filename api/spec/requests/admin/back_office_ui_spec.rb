require "rails_helper"

RSpec.describe "Back office UI fixes from QA", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:parent) { create(:user, first_name: "Thomas", last_name: "Renard") }

  before { admin_log_in(admin) }

  it "BUG-05 gives text links a 44 px click target" do
    create(:verification, user: parent)

    get "/admin/verifications"
    expect(response.body).to match(/class="link-target"[^>]*>Review</)
    expect(response.body).to include(".link-target { display: inline-flex; align-items: center; min-height: 44px; min-width: 44px; }")
  end

  it "BUG-08 shows the oldest verification the admin can review in the hero card" do
    create(:verification, user: admin, submitted_at: 40.hours.ago)
    create(:verification, user: parent, submitted_at: 31.hours.ago)

    get "/admin/verifications"
    expect(response.body[/Oldest waiting.{0,200}/m]).to include("Thomas R.")
  end

  it "BUG-09 shows the reject error outside the dialog and reopens the dialog" do
    verification = create(:verification, user: parent)

    post "/admin/verifications/#{verification.id}/reject", params: { rejection_reason: "" }
    expect(response.body).to include("Not sent: Choose a reason.", 'data-open-on-load="true"')
  end

  it "BUG-10 shows field errors under the field and keeps the email after a wrong password" do
    delete "/admin/logout"
    post "/admin/login", params: { email: admin.email, password: wrong_test_password }

    expect(response.body).to include('id="login-error"', 'aria-describedby="login-error"', "value=\"#{admin.email}\"")
  end

  it "BUG-11 uses the design badges for each verification status" do
    member = create(:user, verification_status: "rejected")
    get "/admin/members/#{member.id}", params: { reason: "user_request" }
    expect(response.body).to include('<span class="badge badge-yellow">Not accepted</span>')

    member.update!(verification_status: "expired")
    get "/admin/members/#{member.id}", params: { reason: "user_request" }
    expect(response.body).to include('<span class="badge badge-yellow">Expired</span>')
  end

  it "BUG-14 marks the active page and uses native modal dialogs" do
    get "/admin/members/#{parent.id}", params: { reason: "user_request" }

    expect(response.body).to include('aria-current="page"', '<dialog class="modal" id="role-dialog"', "showModal()")
  end

  it "BUG-15 keeps the reason label readable in the audit caption" do
    get "/admin/members/#{parent.id}", params: { reason: "email_change_report" }

    expect(response.body).to include("Your access is recorded: &quot;This wasn&#39;t me&quot; report.")
  end

  it "uses the SparkCircles brand in the back office" do
    get "/admin/verifications"

    expect(response.body).to include("<title>SparkCircles admin</title>", 'aria-label="SparkCircles"')
    expect(response.body).not_to include("SPARKCIRCLES")
  end
end
