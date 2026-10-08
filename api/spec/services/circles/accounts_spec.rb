require "rails_helper"

RSpec.describe "Circles and accounts (closure, erasure, data copy)" do
  let(:admin) { create(:user, :verified) }
  let(:circle) { create(:circle, created_by: admin) }

  def close!(user) = Accounts::Closure.new(user).close!

  it "AC-6.4 a sole admin closing their account hands over to the longest-standing verified member" do
    senior = create(:circle_membership, circle: circle, joined_at: 3.days.ago)
    create(:circle_membership, circle: circle, user: create(:user), joined_at: 5.days.ago)
    expect { close!(admin) }.to have_enqueued_mail(CircleMailer, :new_admin)
    expect(senior.reload).to have_attributes(role: "admin", creator: true)
    expect(circle.memberships.find_by(user: admin).status).to eq("left")
    expect(AuditEvent.where(action: "circle_admin_succession").count).to eq(1)
  end

  it "AC-6.4 with no verified member, the circle closes after 30 days' notice to its members" do
    create(:circle_membership, circle: circle, user: create(:user))
    expect { close!(admin) }.to have_enqueued_mail(CircleMailer, :circle_closing)
    expect(circle.reload.closes_on).to eq(Date.current + 30)
    travel 31.days do
      CloseCirclesJob.perform_now
      expect(circle.reload).to be_closed
    end
  end

  it "AC-6.5 (PM 2026-10-08) with only unverified co-admins left, the circle stays open with no verified admin" do
    co_admin = create(:circle_membership, :admin, circle: circle, user: create(:user, :verified))
    co_admin.user.update_columns(verification_status: "expired") # verification lapsed since promotion
    expect { close!(admin) }.not_to have_enqueued_mail(CircleMailer, :circle_closing)
    expect(circle.reload.closes_on).to be_nil
    expect(circle).not_to be_closed
    expect(circle).not_to be_managed
    expect(co_admin.reload).to have_attributes(status: "active", role: "admin")
  end

  it "a circle with no member left is deleted at closure; pending requests are cancelled" do
    circle
    request_row = create(:circle_membership, :pending, circle: create(:circle), user: admin)
    close!(admin)
    expect(Circle.exists?(circle.id)).to be(false)
    expect(request_row.reload.status).to eq("cancelled")
  end

  it "erasure removes memberships and unlinks reports without their text" do
    other = create(:circle)
    member = create(:circle_membership, circle: other, user: create(:user, :closed))
    report = CircleReport.create!(circle: other, reporter: member.user, reason: "other", details: "texte")
    Accounts::Eraser.new(member.user.reload).erase!
    expect(CircleMembership.exists?(member.id)).to be(false)
    expect(report.reload).to have_attributes(reporter_id: nil, details: nil)
  end

  it "AC-17.14, accounts AC-12.1 the data copy includes my circles, requests and reports, never other members" do
    create(:circle_membership, circle: circle, user: create(:user, first_name: "Zoé"))
    create(:circle_membership, :pending, user: admin)
    CircleReport.create!(circle: circle, reporter: admin, reason: "other", details: "note")
    data = Accounts::DataExportBuilder.new(admin).as_json
    expect(data[:circles].sole).to include(name: circle.name, role: "admin", visibility: "public", created_by_me: true)
    expect(data[:circle_requests].sole).to include(status: "pending")
    expect(data[:circle_reports].sole).to include(reason: "other", details: "note")
    expect(data.to_json).not_to include("Zoé")
  end
end
