# Hourly event housekeeping (spec events):
# - AC-8.3: an event that starts while suspended is cancelled.
# - AC-1.6: a published event whose end has passed becomes "past" (search already hides it).
# - AC-17.12: emergency numbers are erased 24 hours after the event ends.
# Participants of a cancelled event get the neutral cancellation email (E3b).
class EventStatusJob < ApplicationJob
  queue_as :default

  def perform
    Event.hosted.where(status: "suspended", starts_at: ..Time.current).find_each do |event|
      event.cancel!
      Events::Notifications.event_cancelled(event, neutral: true)
    end
    Event.where(status: "published").ended.update_all(status: "past", updated_at: Time.current)
    erase_emergency_phones
  end

  private

  def erase_emergency_phones
    over = Event.where(ends_at: ...Event::PHONE_VISIBLE_AFTER_END.ago).select(:id)
    EventParticipation.where(event_id: over).where.not(emergency_phone: nil).update_all(emergency_phone: nil)
  end
end
