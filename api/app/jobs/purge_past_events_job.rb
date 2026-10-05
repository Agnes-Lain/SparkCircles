# AC-7.5: events stay in the history 90 days after they end, then are deleted with their
# participations and reports (retention to confirm with the GDPR advisor).
class PurgePastEventsJob < ApplicationJob
  queue_as :default

  def perform
    Event.expired.in_batches(of: 500) do |batch|
      ids = batch.ids
      EventParticipation.where(event_id: ids).delete_all
      EventReport.where(event_id: ids).delete_all
      Event.where(id: ids).delete_all
    end
  end
end
