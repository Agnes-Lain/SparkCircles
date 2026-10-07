# A member's report about a circle or one of its members (spec circles US-7). Only
# SparkCircles admins see it (AC-7.2): never the reported person, other members or the
# circle's admins. `details` is free text, encrypted like other personal data.
class CircleReport < ApplicationRecord
  include EncryptedPersonalData

  CIRCLE_REASONS = %w[unsafe not_real_group other].freeze
  MEMBER_REASONS = %w[inappropriate_behaviour child_safety fake_identity other].freeze
  DETAILS_MAX = 500

  personal_data :details

  belongs_to :circle, inverse_of: :reports
  belongs_to :reporter, class_name: "User", optional: true
  belongs_to :reported_user, class_name: "User", optional: true

  normalizes :details, with: ->(value) { value.strip.presence }

  validates :reason, presence: true
  validates :reason, inclusion: { in: ->(report) { report.reasons } }, allow_blank: true
  validates :details, length: { maximum: DETAILS_MAX }

  scope :open, -> { where(resolved_at: nil) }

  def member_report? = reported_user_id.present?
  def reasons = member_report? ? MEMBER_REASONS : CIRCLE_REASONS
  def reason_label = I18n.t("circles.report_reasons.#{reason}")
end
