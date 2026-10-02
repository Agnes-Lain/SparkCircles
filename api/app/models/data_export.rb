# A copy of a user's data (US-12). The file is encrypted at rest (AC-10.2).
class DataExport < ApplicationRecord
  include EncryptedAttachments

  DOWNLOAD_WINDOW = 7.days

  belongs_to :user
  has_one_attached :file

  enum :status, { pending: "pending", ready: "ready", expired: "expired" }, validate: true

  scope :to_expire, -> { ready.where(expires_at: ..Time.current) }

  def downloadable?
    ready? && expires_at.future? && file.attached?
  end

  def expire!
    file.purge if file.attached?
    update!(status: "expired")
  end
end
