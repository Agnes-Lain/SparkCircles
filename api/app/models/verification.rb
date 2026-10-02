# An identity verification request (US-7, US-9).
class Verification < ApplicationRecord
  include EncryptedPersonalData
  include EncryptedAttachments

  DOCUMENT_TYPES = %w[passport national_id_card driving_licence residence_permit other_residence_card].freeze
  SINGLE_SIDED_DOCUMENTS = %w[passport].freeze
  REJECTION_REASONS = %w[photo_blurry document_cut_off document_expired document_not_accepted selfie_mismatch name_mismatch].freeze
  REVOCATION_REASONS = %w[safety_report other].freeze
  ALLOWED_CONTENT_TYPES = %w[image/jpeg image/png image/heic image/heif].freeze
  MAX_FILE_SIZE = 10.megabytes
  MAX_VALIDITY = 2.years
  FILE_RETENTION = 30.days

  belongs_to :user
  belongs_to :reviewer, class_name: "User", optional: true
  has_one_attached :document_front
  has_one_attached :document_back
  has_one_attached :selfie

  personal_data :note, :revocation_note
  personal_data :document_expires_on, type: :date

  enum :status, { pending: "pending", approved: "approved", rejected: "rejected" }, validate: true

  validates :document_type, inclusion: { in: DOCUMENT_TYPES }
  validates :rejection_reason, inclusion: { in: REJECTION_REASONS }, allow_nil: true
  validates :revocation_reason, inclusion: { in: REVOCATION_REASONS }, allow_nil: true

  scope :queue, -> { pending.order(:submitted_at) }
  scope :files_to_purge, -> { where(files_purged_at: nil).where(decided_at: ...FILE_RETENTION.ago) }

  def self.double_sided?(document_type)
    SINGLE_SIDED_DOCUMENTS.exclude?(document_type)
  end

  def double_sided? = self.class.double_sided?(document_type)
  def decided? = decided_at.present?
  def revoked? = revoked_at.present?
  def files_available? = files_purged_at.nil?

  def waiting_time
    Time.current - submitted_at
  end

  # AC-7.11: valid until the document's expiry or 2 years after approval, whichever comes first.
  def self.validity_end(document_expires_on, approved_on: Date.current)
    [ document_expires_on, approved_on + MAX_VALIDITY ].min
  end

  # AC-7.10: erase the images; keep outcome, document type, expiry date, decision date, reviewer.
  def purge_files!
    [ document_front, document_back, selfie ].each { |file| file.purge if file.attached? }
    update!(files_purged_at: Time.current)
  end

  def file_content_type(name)
    { document_front: front_content_type, document_back: back_content_type, selfie: selfie_content_type }.fetch(name.to_sym)
  end
end
