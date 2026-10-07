# AC-2.4: the grouped "new requests" e-mail to a circle's admins, one hour after the
# previous one (Circles::Notifications.request_received).
class DeliverCircleRequestDigestJob < ApplicationJob
  queue_as :default
  discard_on ActiveJob::DeserializationError

  def perform(circle)
    Circles::Notifications.deliver_request_digest(circle)
  end
end
