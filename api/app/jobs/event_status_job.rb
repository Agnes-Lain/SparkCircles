# Hourly event housekeeping (spec events):
# - AC-8.3: an event that starts while suspended is cancelled.
# - AC-1.6: a published event whose end has passed becomes "past" (search already hides it).
# Participants of a cancelled event get the neutral cancellation email (E3b).
class EventStatusJob < ApplicationJob
  queue_as :default

  def perform
    Event.hosted.where(status: "suspended", starts_at: ..Time.current).find_each do |event|
      event.cancel!
      Events::Notifications.event_cancelled(event, neutral: true)
    end
    Event.where(status: "published").ended.update_all(status: "past", updated_at: Time.current)
  end
end
