# US-9: a member's report about an event. The host never learns who reported (AC-9.2);
# `details` is free text, so it's encrypted like other personal data.
class EventReport < ApplicationRecord
  include EncryptedPersonalData

  REASONS = %w[dangerous_place suspicious_host inappropriate_content inappropriate_tag other].freeze
  DETAILS_MAX = 500
  # AC-9.4: reports from this many different members flag the event as urgent (PM to confirm).
  URGENT_THRESHOLD = 3

  personal_data :details

  belongs_to :event, inverse_of: :reports
  belongs_to :reporter, class_name: "User", optional: true

  normalizes :details, with: ->(value) { value.strip.presence }

  validates :reason, presence: true, inclusion: { in: REASONS, allow_blank: true }
  validates :details, length: { maximum: DETAILS_MAX }

  scope :open, -> { where(resolved_at: nil) }

  def reason_label = I18n.t("events.report_reasons.#{reason}")
end
