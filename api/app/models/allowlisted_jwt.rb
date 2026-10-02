# One row per logged-in device (AC-3.4 to AC-3.6).
class AllowlistedJwt < ApplicationRecord
  INACTIVITY_LIMIT = 30.days
  USAGE_REFRESH_INTERVAL = 1.hour
  # BUG-13: tokens last 60 days and are renewed when less than 30 days are left, so a
  # device that keeps being used stays logged in (AC-3.4).
  LIFETIME = 60.days
  RENEWAL_WINDOW = 30.days

  belongs_to :user

  scope :stale, -> { where(last_used_at: ...INACTIVITY_LIMIT.ago).or(where(exp: ..Time.current)) }

  before_validation { self.last_used_at ||= Time.current }

  def stale?
    last_used_at < INACTIVITY_LIMIT.ago
  end

  def renewal_due?
    exp < RENEWAL_WINDOW.from_now && !user.allowlisted_jwts.where(device_id: device_id).where("exp > ?", exp).exists?
  end

  def record_usage!
    update_column(:last_used_at, Time.current) if last_used_at < USAGE_REFRESH_INTERVAL.ago
  end
end
