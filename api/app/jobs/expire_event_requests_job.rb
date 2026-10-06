# US-17, AC-17.19: an unanswered request expires 48 hours after it was sent, or at the
# event start, whichever comes first; the parent gets the neutral E-D email. Requests of a
# suspended event are frozen (AC-17.23) and wait for it to resume or be cancelled.
class ExpireEventRequestsJob < ApplicationJob
  queue_as :default

  def perform
    overdue = EventParticipation.awaiting_host.where(requested_at: ..EventParticipation::REQUEST_LIFETIME.ago)
    started = EventParticipation.awaiting_host.where(event_id: Event.where(starts_at: ..Time.current).select(:id))
    event_ids = overdue.or(started).distinct.pluck(:event_id)
    Event.hosted.where(id: event_ids, status: %w[published past]).find_each do |event|
      Events::Requests.new(event).expire_overdue
    end
  end
end
