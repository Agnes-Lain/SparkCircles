# Users (spec US-1 to US-13). Columns marked "encrypted" hold Active Record
# Encryption ciphertext (see EncryptedPersonalData), never plain text (AC-10.1).
class CreateUsers < ActiveRecord::Migration[8.1]
  def change
    create_table :users, id: :uuid, default: -> { "uuidv7()" } do |t|
      t.string :first_name, null: false
      t.text :last_name, null: false                     # encrypted
      t.string :email, null: false                       # encrypted, deterministic (login lookup)
      t.string :encrypted_password, null: false, default: ""
      t.string :locale, null: false, default: "fr"

      # Devise recoverable / confirmable / lockable
      t.string :reset_password_token
      t.datetime :reset_password_sent_at
      t.string :confirmation_token
      t.datetime :confirmed_at
      t.datetime :confirmation_sent_at
      t.string :unconfirmed_email                        # encrypted, deterministic
      t.integer :failed_attempts, null: false, default: 0
      t.datetime :last_failed_attempt_at
      t.string :unlock_token
      t.datetime :locked_at

      # devise-two-factor (admins in the web back office)
      t.string :otp_secret                               # encrypted by devise-two-factor
      t.integer :consumed_timestep
      t.boolean :otp_required_for_login, null: false, default: false
      t.string :otp_backup_codes, array: true

      # Profile and verification data
      t.text :city_shown                                 # encrypted
      t.text :date_of_birth                              # encrypted
      t.string :verification_status, null: false, default: "not_verified"
      t.text :verification_expires_on                    # encrypted
      t.datetime :verification_reminder_30_sent_at
      t.datetime :verification_reminder_7_sent_at

      # Consents (AC-1.1, AC-5.2 to AC-5.4)
      t.datetime :adult_confirmed_at
      t.string :terms_version
      t.datetime :terms_accepted_at
      t.string :privacy_version
      t.datetime :privacy_accepted_at
      t.boolean :marketing_opt_in, null: false, default: false
      t.datetime :marketing_opt_in_changed_at

      # Account state
      t.datetime :security_locked_at                     # "This wasn't me" report (AC-13.8)
      t.datetime :closed_at                              # closure grace period (AC-11.x)

      t.timestamps
    end

    add_index :users, :email, unique: true
    add_index :users, :reset_password_token, unique: true
    add_index :users, :confirmation_token, unique: true
    add_index :users, :unlock_token, unique: true
    add_index :users, :verification_status
    add_index :users, :closed_at
    add_check_constraint :users, "verification_status IN ('not_verified', 'pending', 'verified', 'rejected', 'expired')",
      name: "users_verification_status_check"
    add_check_constraint :users, "locale IN ('fr', 'en')", name: "users_locale_check"
  end
end
