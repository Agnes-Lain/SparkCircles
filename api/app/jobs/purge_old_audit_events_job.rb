# AC-10.5: audit entries are kept at least 1 year; entries older than 13 months are deleted.
class PurgeOldAuditEventsJob < ApplicationJob
  queue_as :default

  def perform
    AuditEvent.expired.delete_all
  end
end
