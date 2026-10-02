# Encrypts files (ID documents, selfies, data copies) before they reach storage,
# so the storage files alone are unreadable (AC-10.2).
#
# AES-256-GCM with a key derived from the Active Record Encryption primary key,
# which lives outside the database and the bucket (AC-10.3).
# Format: 12-byte IV + 16-byte auth tag + ciphertext.
class FileEncryptor
  CIPHER = "aes-256-gcm".freeze
  IV_LENGTH = 12
  TAG_LENGTH = 16

  class DecryptionError < StandardError; end

  def self.encrypt(data)
    cipher = OpenSSL::Cipher.new(CIPHER).encrypt
    cipher.key = key
    iv = cipher.random_iv
    ciphertext = cipher.update(data) + cipher.final
    iv + cipher.auth_tag + ciphertext
  end

  def self.decrypt(blob)
    blob = blob.b
    iv = blob.byteslice(0, IV_LENGTH)
    tag = blob.byteslice(IV_LENGTH, TAG_LENGTH)
    ciphertext = blob.byteslice((IV_LENGTH + TAG_LENGTH)..)
    cipher = OpenSSL::Cipher.new(CIPHER).decrypt
    cipher.key = key
    cipher.iv = iv
    cipher.auth_tag = tag
    cipher.update(ciphertext) + cipher.final
  rescue OpenSSL::Cipher::CipherError, ArgumentError => e
    raise DecryptionError, e.class.name
  end

  def self.key
    primary_key = Array(ActiveRecord::Encryption.config.primary_key).first
    raise "Active Record Encryption primary key is not configured" if primary_key.blank?

    ActiveSupport::KeyGenerator.new(primary_key, hash_digest_class: OpenSSL::Digest::SHA256)
      .generate_key("sparkcircles/file-encryption", 32)
  end
  private_class_method :key
end
