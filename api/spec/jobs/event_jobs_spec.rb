require "rails_helper"

RSpec.describe "Event jobs" do
  describe EventStatusJob do
    it "AC-8.3 cancels an event that starts while suspended" do
      event = create(:event, :suspended)
      travel_to(event.starts_at + 1.minute) { described_class.perform_now }
      expect(event.reload).to be_cancelled
    end

    it "AC-1.6 marks ended published events as past" do
      event = create(:event, :ended)
      described_class.perform_now
      expect(event.reload.status).to eq("past")
    end
  end

  describe PurgePastEventsJob do
    it "AC-7.5 deletes events ended more than 90 days ago with participations and reports" do
      old = create(:event)
      create(:event_participation, event: old)
      EventReport.create!(event: old, reporter: create(:user), reason: "other")
      recent = create(:event)
      travel_to(old.ends_at + 91.days) do
        recent.update_columns(starts_at: 10.days.ago, ends_at: 10.days.ago + 1.hour)
        described_class.perform_now
      end
      expect(Event.exists?(old.id)).to be(false)
      expect(EventParticipation.where(event_id: old.id)).to be_empty
      expect(EventReport.where(event_id: old.id)).to be_empty
      expect(Event.exists?(recent.id)).to be(true)
    end
  end
end
