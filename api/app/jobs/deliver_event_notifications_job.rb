# Sends one batch of event emails when its window ends (Events::Notifications). A batch
# whose window moved (quiet hours) or that was already sent is skipped: the job scheduled
# for the new time sends it.
class DeliverEventNotificationsJob < ApplicationJob
  queue_as :default

  def perform(batch_id)
    batch = PendingEventNotification.find_by(id: batch_id)
    Events::Notifications.deliver(batch) if batch
  end
end
