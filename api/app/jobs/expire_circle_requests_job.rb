# Circles AC-2.6: requests unanswered for 30 days expire (the person is told they can ask
# again); spec section 7: requests that block nothing are deleted 90 days after the decision.
class ExpireCircleRequestsJob < ApplicationJob
  queue_as :default

  def perform
    Circles::Requests.expire_overdue!
    Circles::Requests.purge_old!
  end
end
