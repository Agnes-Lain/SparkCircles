# An email change that took effect (AC-13.7, AC-13.8).
class EmailChange < ApplicationRecord
  include EncryptedPersonalData

  REPORT_WINDOW = 30.days

  belongs_to :user

  personal_data :previous_email, :new_email

  scope :reported, -> { where.not(reported_at: nil) }
  scope :open_reports, -> { reported.where(restored_at: nil) }

  generates_token_for :report, expires_in: REPORT_WINDOW do
    reported_at
  end

  def reported? = reported_at.present?
end
