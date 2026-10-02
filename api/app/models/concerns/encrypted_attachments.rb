# Attach and read Active Storage files encrypted with FileEncryptor (AC-10.2).
# Stored blobs get a generic name and type; the real content type is kept on the record.
module EncryptedAttachments
  extend ActiveSupport::Concern

  def attach_encrypted(name, io_or_upload, filename:)
    data = io_or_upload.respond_to?(:read) ? io_or_upload.read : io_or_upload
    public_send(name).attach(
      io: StringIO.new(FileEncryptor.encrypt(data)),
      filename: "#{filename}.bin",
      content_type: "application/octet-stream",
      identify: false
    )
  end

  def read_encrypted(name)
    attachment = public_send(name)
    return unless attachment.attached?

    FileEncryptor.decrypt(attachment.download)
  end
end
