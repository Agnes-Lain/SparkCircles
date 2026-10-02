require "rails_helper"

RSpec.describe AuditEvent do
  let(:event) { AuditEvent.record!(action: "viewed_member", reason: "user_request", ip_address: "203.0.113.4") }

  it "AC-10.5 can't be edited, even directly in the database" do
    expect { event.update!(reason: "safety_report") }.to raise_error(ActiveRecord::ReadOnlyRecord)
    expect { AuditEvent.where(id: event.id).update_all(reason: "safety_report") }
      .to raise_error(ActiveRecord::StatementInvalid, /append-only/)
  end

  it "AC-10.5 can't be deleted before 13 months, even directly in the database" do
    expect { AuditEvent.where(id: event.id).delete_all }.to raise_error(ActiveRecord::StatementInvalid, /13 months/)
    expect { event.destroy }.to raise_error(ActiveRecord::ReadOnlyRecord)
  end

  it "AC-10.5 is deleted after 13 months by the monthly job, and recent entries stay" do
    event
    old = AuditEvent.create!(action: "viewed_member", created_at: 14.months.ago)

    PurgeOldAuditEventsJob.perform_now

    expect(AuditEvent.exists?(old.id)).to be(false)
    expect(AuditEvent.exists?(event.id)).to be(true)
  end

  it "AC-10.1 encrypts the IP address" do
    raw = AuditEvent.connection.select_value("SELECT ip_address FROM audit_events WHERE id = #{AuditEvent.connection.quote(event.id)}")

    expect(raw).not_to include("203.0.113.4")
    expect(event.reload.ip_address).to eq("203.0.113.4")
  end
end
