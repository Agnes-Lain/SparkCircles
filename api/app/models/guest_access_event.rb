# AC-15.13: technical security log of anonymous traffic. No raw network address, no
# search terms, no device id; deleted after 30 days (PurgeGuestAccessEventsJob).
class GuestAccessEvent < ApplicationRecord
  KINDS = %w[rate_limited blocked client_refused].freeze
  RETENTION = 30.days

  validates :kind, inclusion: { in: KINDS }
  validates :ip_hash, :endpoint, presence: true

  scope :expired, -> { where(created_at: ...RETENTION.ago) }
end
