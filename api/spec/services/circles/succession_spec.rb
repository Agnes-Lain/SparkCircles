require "rails_helper"

RSpec.describe Circles::Succession do
  let(:admin) { create(:user, :verified) }
  let(:circle) { create(:circle, created_by: admin) }
  let(:admin_row) { circle.memberships.find_by(user: admin) }

  def join(user = create(:user, :verified), **attributes)
    create(:circle_membership, circle: circle, user: user, **attributes)
  end

  def unverify!(user) = user.update!(verification_status: "expired")
  def verify!(user) = user.update!(verification_status: "verified", verification_expires_on: 1.year.from_now.to_date)

  describe "AC-6.5 an admin loses verification" do
    it "keeps the role without rights while another admin with rights takes over" do
      co_admin = join(role: "admin", admin_since: 2.days.ago)
      join(joined_at: 5.days.ago)
      expect { unverify!(admin) }.not_to have_enqueued_mail(CircleMailer, :new_admin)
      expect(admin_row.reload).to have_attributes(role: "admin", former_admin_at: nil)
      expect(co_admin.reload.role).to eq("admin")
      expect(circle.reload).to be_managed
    end

    it "makes the longest-standing verified member admin, told by e-mail; the former admin steps back" do
      join(create(:user), joined_at: 6.days.ago)
      senior = join(joined_at: 5.days.ago)
      join(joined_at: 2.days.ago)
      expect { unverify!(admin) }.to have_enqueued_mail(CircleMailer, :new_admin).with(circle, senior.user, "no_verified_admin")
      expect(senior.reload).to have_attributes(role: "admin", creator: true)
      expect(admin_row.reload).to have_attributes(role: "member", creator: false)
      expect(admin_row.former_admin_at).to be_present
      expect(circle.reload).to be_managed
      expect(AuditEvent.where(action: "circle_admin_succession").count).to eq(1)
    end

    it "with no verified member, nothing moves: no requests, out of search, has_verified_admin false" do
      join(create(:user))
      expect { unverify!(admin) }.not_to have_enqueued_mail(CircleMailer, :new_admin)
      expect(admin_row.reload.role).to eq("admin")
      expect(circle.reload).not_to be_managed
      expect(circle).not_to be_accepting_requests
      expect(circle).not_to be_discoverable
    end

    it "does nothing for a member who isn't admin" do
      member = join
      unverify!(member.user)
      expect(admin_row.reload.role).to eq("admin")
      expect(member.reload.role).to eq("member")
    end
  end

  describe "AC-6.5 someone gets verified" do
    it "the first member to get verified becomes admin when no verified admin is left" do
      unverify!(admin)
      member = join(create(:user))
      expect { verify!(member.user) }.to have_enqueued_mail(CircleMailer, :new_admin).with(circle, member.user, "no_verified_admin")
      expect(member.reload).to have_attributes(role: "admin", creator: true)
      expect(admin_row.reload).to have_attributes(role: "member")
      expect(admin_row.former_admin_at).to be_present
      expect(circle.reload).to be_accepting_requests
    end

    it "an admin who verifies again simply gets their rights back" do
      join(create(:user))
      unverify!(admin)
      expect { verify!(admin) }.not_to have_enqueued_mail(CircleMailer, :new_admin)
      expect(admin_row.reload).to have_attributes(role: "admin", creator: true)
      expect(circle.reload).to be_managed
    end

    it "a former admin who verifies again returns as co-admin when there is room" do
      successor = join(joined_at: 3.days.ago)
      unverify!(admin)
      verify!(admin)
      expect(admin_row.reload).to have_attributes(role: "admin", creator: false, former_admin_at: nil)
      expect(successor.reload).to have_attributes(role: "admin", creator: true)
    end

    it "a former admin stays a member when the circle already has 3 admins" do
      successor = join(joined_at: 3.days.ago)
      unverify!(admin)
      2.times { join(role: "admin", admin_since: 1.day.ago) }
      verify!(admin)
      expect(admin_row.reload).to have_attributes(role: "member", former_admin_at: nil)
      expect(circle.admins.count).to eq(3)
      expect(successor.reload.role).to eq("admin")
    end

    it "a member verifying in a circle that has a verified admin changes nothing" do
      member = join(create(:user))
      expect { verify!(member.user) }.not_to have_enqueued_mail(CircleMailer, :new_admin)
      expect(member.reload.role).to eq("member")
    end
  end

  it "AC-6.4 account closure reuses the succession when the other admins aren't verified" do
    other_admin = join(create(:user), role: "admin", admin_since: 1.day.ago)
    senior = join(joined_at: 4.days.ago)
    expect { Accounts::Closure.new(admin).close! }.to have_enqueued_mail(CircleMailer, :new_admin).with(circle, senior.user, "closed_account")
    expect(senior.reload).to have_attributes(role: "admin", creator: true)
    expect(other_admin.reload).to have_attributes(role: "member")
  end
end
