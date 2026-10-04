# An email change that took effect (AC-13.7, AC-13.8).
class EmailChange < ApplicationRecord
  include EncryptedPersonalData

  REPORT_WINDOW = 30.days

  belongs_to :user

  personal_data :previous_email, :new_email

  scope :reported, -> { where.not(reported_at: nil) }
  scope :open_reports, -> { reported.where(restored_at: nil, closed_at: nil) }
  scope :resolved_reports, -> { reported.where.not(restored_at: nil).or(reported.where.not(closed_at: nil)) }

  # The link stays readable after a report so a second opening can answer "already reported"
  # (D-4); reporting twice changes nothing (see EmailChangeReportsController).
  generates_token_for :report, expires_in: REPORT_WINDOW

  def reported? = reported_at.present?
  def open_report? = reported? && restored_at.nil? && closed_at.nil?
end
