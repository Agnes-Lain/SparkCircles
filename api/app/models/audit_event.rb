# Append-only audit log (AC-10.4, AC-10.5). The database refuses updates and early
# deletes (trigger); the model refuses them too.
class AuditEvent < ApplicationRecord
  include EncryptedPersonalData

  RETENTION = 13.months
  REASONS = {
    "verification_review" => "Verification review",
    "user_request" => "User request",
    "safety_report" => "Safety report",
    "verification_follow_up" => "Verification follow-up",
    "email_change_report" => "\"This wasn't me\" report"
  }.freeze

  personal_data :ip_address, :note

  validates :action, presence: true
  validates :reason, inclusion: { in: REASONS.keys }, allow_nil: true

  scope :expired, -> { where(created_at: ...RETENTION.ago) }

  def readonly?
    persisted?
  end

  def self.record!(action:, actor: nil, subject: nil, fields: [], reason: nil, ip_address: nil, metadata: {}, note: nil)
    create!(action: action, actor_id: actor&.id, subject_user_id: subject&.id, fields: fields,
            reason: reason, ip_address: ip_address, metadata: metadata, note: note)
  end

  def reason_label = REASONS[reason]
end
