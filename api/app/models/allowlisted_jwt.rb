# One row per logged-in device (AC-3.4 to AC-3.6).
class AllowlistedJwt < ApplicationRecord
  INACTIVITY_LIMIT = 30.days
  USAGE_REFRESH_INTERVAL = 1.hour

  belongs_to :user

  scope :stale, -> { where(last_used_at: ...INACTIVITY_LIMIT.ago) }

  before_validation { self.last_used_at ||= Time.current }

  def stale?
    last_used_at < INACTIVITY_LIMIT.ago
  end

  def record_usage!
    update_column(:last_used_at, Time.current) if last_used_at < USAGE_REFRESH_INTERVAL.ago
  end
end
