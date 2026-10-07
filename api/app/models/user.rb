# A SparkCircles account: an adult (18+) with one or several roles (US-1, AC-1.7).
class User < ApplicationRecord
  include EncryptedPersonalData
  include Devise::JWT::RevocationStrategies::Allowlist

  CLOSURE_GRACE_PERIOD = 30.days
  UNCONFIRMED_LIFETIME = 7.days
  FAILED_ATTEMPTS_WINDOW = 15.minutes
  EXPIRY_SOON_WINDOW = 30.days
  VERIFICATION_STATUSES = %w[not_verified pending verified rejected expired].freeze
  LOCALES = %w[fr en].freeze

  devise :two_factor_authenticatable, :two_factor_backupable,
         :confirmable, :recoverable, :lockable, :timeoutable,
         :jwt_authenticatable, jwt_revocation_strategy: self,
         otp_backup_code_length: 5, otp_number_of_backup_codes: 10

  personal_data :email, :unconfirmed_email, lookup: true
  personal_data :last_name, :city_shown
  personal_data :date_of_birth, :verification_expires_on, type: :date

  has_many :roles, dependent: :delete_all
  has_many :verifications, -> { order(:submitted_at) }, dependent: :destroy
  has_many :email_changes, dependent: :delete_all
  has_many :data_exports, dependent: :destroy
  # Deleted by the database (on delete cascade) when the account is erased.
  has_many :hosted_events, class_name: "Event", foreign_key: :host_id, inverse_of: :host, dependent: nil
  has_many :event_participations, dependent: nil
  # Unlinked by the database (reporter_id set to NULL) on erasure; Accounts::Eraser wipes the text first.
  has_many :event_reports, foreign_key: :reporter_id, dependent: nil, inverse_of: false
  # Circles: memberships and requests go with the account (on delete cascade); reports sent
  # are unlinked (reporter_id set to NULL), Accounts::Eraser wipes their text first.
  has_many :circle_memberships, dependent: nil
  has_many :circle_reports, foreign_key: :reporter_id, dependent: nil, inverse_of: :reporter

  attribute :adult_confirmed, :boolean
  attribute :terms_accepted, :boolean

  normalizes :first_name, :last_name, with: ->(value) { value.squish }
  normalizes :city_shown, with: ->(value) { value.squish.presence }
  normalizes :email, with: ->(value) { value.strip.downcase }

  validates :first_name, presence: true, length: { maximum: 100 }
  validates :last_name, presence: true, length: { maximum: 100 }
  validates :city_shown, length: { maximum: 100 }
  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP, message: :invalid }, uniqueness: true
  validates :password, presence: true, if: :password_required?
  validates :password, password_policy: true, allow_blank: true
  validates :locale, inclusion: { in: LOCALES }
  validates :verification_status, inclusion: { in: VERIFICATION_STATUSES }
  validate :required_consents_given, on: :registration

  after_create :grant_parent_role
  # Events US-8: hosts losing or regaining verification, and account closure.
  after_update_commit :sync_events, if: :event_rights_changed?

  scope :closed, -> { where.not(closed_at: nil) }
  scope :due_for_erasure, -> { closed.where(closed_at: ...CLOSURE_GRACE_PERIOD.ago) }
  scope :unconfirmed_expired, -> { where(confirmed_at: nil, created_at: ...UNCONFIRMED_LIFETIME.ago) }

  # ---- Tokens (devise-jwt Allowlist, AC-3.4 to AC-3.6) ----

  # A token is valid while its device row exists and was used in the last 30 days.
  def self.jwt_revoked?(payload, user)
    token = user.allowlisted_jwts.find_by(jti: payload["jti"])
    return true if token.nil? || token.stale? || user.security_locked?

    token.record_usage!
    false
  end

  def issue_token!(device_name: nil, device_id: nil)
    token, payload = Warden::JWTAuth::UserEncoder.new.call(self, :user, nil)
    attributes = { jti: payload["jti"], aud: payload["aud"], exp: Time.zone.at(payload["exp"]),
                   device_name: device_name.to_s.first(100).presence, last_used_at: Time.current }
    attributes[:device_id] = device_id if device_id
    allowlisted_jwts.create!(attributes)
    token
  end

  # Logs out every device, except the device that holds `except_jti` (its renewed
  # tokens included) when given.
  def revoke_all_tokens!(except_jti: nil)
    scope = allowlisted_jwts
    if except_jti && (device_id = allowlisted_jwts.where(jti: except_jti).pick(:device_id))
      scope = scope.where.not(device_id: device_id)
    end
    scope.delete_all
  end

  def revoke_device!(jti)
    device_id = allowlisted_jwts.where(jti: jti).pick(:device_id)
    allowlisted_jwts.where(device_id: device_id).delete_all if device_id
  end

  # ---- Roles (AC-1.5, AC-1.7, AC-9.6) ----

  def role_names = roles.map(&:name).sort
  def admin? = roles.any? { |role| role.name == "admin" }
  def parent? = roles.any? { |role| role.name == "parent" }

  # ---- Login protection (AC-3.3, AC-13.8) ----

  # Devise counts consecutive failures; the spec counts failures within 15 minutes.
  def valid_for_authentication?
    if failed_attempts.positive? && !access_locked? && last_failed_attempt_at&.before?(FAILED_ATTEMPTS_WINDOW.ago)
      update_columns(failed_attempts: 0, last_failed_attempt_at: nil)
    end
    super
  end

  def increment_failed_attempts
    super
    update_column(:last_failed_attempt_at, Time.current)
  end

  def lock_access!(opts = {})
    super
    AccountMailer.account_locked(self).deliver_later
  end

  def security_locked? = security_locked_at.present?

  # BUG-07: an unknown email costs the same bcrypt work as a wrong password, so the
  # response time doesn't reveal whether an account exists (AC-3.2).
  def self.spend_password_check_time(password)
    @dummy_password_digest ||= Devise::Encryptor.digest(self, SecureRandom.hex(16))
    Devise::Encryptor.compare(self, @dummy_password_digest, password.to_s)
    nil
  end

  # Admin web sessions only (parents use tokens, see AllowlistedJwt).
  def timeout_in = 12.hours

  # ---- Back office session (AC-9.5, QA BUG-01 and BUG-04) ----
  # The cookie holds a random nonce; the database holds its digest. Only the latest
  # nonce works, so a copied or replayed cookie stops working at each step, at logout
  # and when the code step is locked.

  MAX_OTP_ATTEMPTS = 5
  OTP_LOCK_DURATION = 15.minutes

  def start_admin_session!
    nonce = SecureRandom.urlsafe_base64(32)
    update_columns(admin_session_digest: self.class.admin_nonce_digest(nonce), admin_pending_digest: nil)
    nonce
  end

  def admin_session_valid?(nonce)
    nonce.present? && admin_session_digest.present? &&
      ActiveSupport::SecurityUtils.secure_compare(self.class.admin_nonce_digest(nonce), admin_session_digest)
  end

  def end_admin_session!
    update_columns(admin_session_digest: nil, admin_pending_digest: nil)
  end

  # Password step only (QA R2-03): its own nonce, so the live session stays untouched
  # until the second factor succeeds (complete_login! then rotates the live nonce).
  def start_admin_login!
    nonce = SecureRandom.urlsafe_base64(32)
    update_columns(admin_pending_digest: self.class.admin_nonce_digest(nonce))
    nonce
  end

  def admin_login_pending?(nonce)
    nonce.present? && admin_pending_digest.present? &&
      ActiveSupport::SecurityUtils.secure_compare(self.class.admin_nonce_digest(nonce), admin_pending_digest)
  end

  def self.admin_nonce_digest(nonce) = OpenSSL::Digest::SHA256.hexdigest(nonce.to_s)

  def otp_locked? = otp_locked_until.present? && otp_locked_until.future?

  # Wrong authenticator codes are counted here, never in the cookie.
  def register_otp_failure!
    attempts = otp_failed_attempts + 1
    if attempts >= MAX_OTP_ATTEMPTS
      update_columns(otp_failed_attempts: 0, otp_locked_until: OTP_LOCK_DURATION.from_now, admin_pending_digest: nil)
    else
      update_columns(otp_failed_attempts: attempts)
    end
  end

  def reset_otp_failures!
    update_columns(otp_failed_attempts: 0, otp_locked_until: nil)
  end

  # Devise emails go through Active Job, without the token in the job arguments
  # (see AccountTokenEmailJob, AC-10.6).
  def send_devise_notification(notification, *_args)
    AccountTokenEmailJob.perform_later(self, notification.to_s)
  end

  # ---- Profile and visibility (US-6) ----

  def last_name_initial = last_name.to_s.first.upcase
  def display_name = "#{first_name} #{last_name_initial}."
  def visible_to_others? = confirmed? && !closed?

  # ---- Consents (US-5) ----

  def terms_acceptance_required?
    legal = Rails.configuration.x.legal
    return false unless legal[:requires_acceptance]

    terms_version != legal[:terms_version] || privacy_version != legal[:privacy_version]
  end

  def accept_current_terms(at: Time.current)
    legal = Rails.configuration.x.legal
    self.terms_version = legal[:terms_version]
    self.terms_accepted_at = at
    self.privacy_version = legal[:privacy_version]
    self.privacy_accepted_at = at
  end

  # AC-11.2: closed accounts never receive marketing, whatever their saved choice.
  def receives_marketing? = marketing_opt_in && confirmed? && !closed?

  def marketing_opt_in=(value)
    value = ActiveModel::Type::Boolean.new.cast(value) || false
    self.marketing_opt_in_changed_at = Time.current if value != marketing_opt_in
    super(value)
  end

  # ---- Verification (US-7, US-8) ----

  # The one server rule every restricted action uses (AC-7.14, AC-8.4, AC-8.5).
  def verified?
    verification_status == "verified" && verification_expires_on.present? && verification_expires_on > Date.current
  end

  def verification_expires_soon?
    verified? && verification_expires_on <= Date.current + EXPIRY_SOON_WINDOW
  end

  def latest_verification = verifications.last
  def pending_verification = verifications.find(&:pending?)

  # AC-7.15: a verification sent while still verified is a renewal; the parent keeps
  # every verified right until the old one expires or the renewal is decided.
  def renewal_pending? = verifications.any? { |verification| verification.pending? && verification.renewal? }

  # AC-7.8: a verified parent who changes their name must verify again.
  def reset_verification_if_name_changed
    return unless verification_status == "verified" && (first_name_changed? || last_name_changed?)

    self.verification_status = "not_verified"
    self.verification_expires_on = nil
  end

  # ---- Closure (US-11) ----

  def closed? = closed_at.present?
  def erasure_on = closed? ? (closed_at + CLOSURE_GRACE_PERIOD).to_date : nil

  private

  def event_rights_changed?
    saved_change_to_verification_status? || saved_change_to_verification_expires_on? || saved_change_to_closed_at?
  end

  def sync_events
    Events::HostStatusSync.new(self).call
    # Circles AC-6.4: closing an account leaves every circle (admin succession first).
    Circles::Departure.close_account!(self) if saved_change_to_closed_at? && closed?
  end

  # AC-1.2: both boxes must be ticked; each missing one is reported.
  def required_consents_given
    errors.add(:adult_confirmed, :must_be_accepted) unless adult_confirmed
    errors.add(:terms_accepted, :must_be_accepted) unless terms_accepted
  end

  def password_required?
    !persisted? || !password.nil?
  end

  def grant_parent_role
    roles.create!(name: "parent")
  end
end
