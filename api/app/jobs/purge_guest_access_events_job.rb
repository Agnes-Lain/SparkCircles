# AC-15.13: the guest security log is kept 30 days.
class PurgeGuestAccessEventsJob < ApplicationJob
  queue_as :default

  def perform
    GuestAccessEvent.expired.delete_all
  end
end
