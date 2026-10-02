# AC-3.4: device tokens unused for 30 days are deleted (they are already refused).
class PurgeStaleTokensJob < ApplicationJob
  queue_as :default

  def perform
    AllowlistedJwt.stale.delete_all
  end
end
