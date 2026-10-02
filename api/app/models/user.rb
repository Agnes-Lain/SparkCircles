# A SPARKCIRCLES account: an adult (18+) with one or several roles (US-1, AC-1.7).
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

  def issue_token!(device_name: nil)
    token, payload = Warden::JWTAuth::UserEncoder.new.call(self, :user, nil)
    allowlisted_jwts.create!(jti: payload["jti"], aud: payload["aud"], exp: Time.zone.at(payload["exp"]),
                             device_name: device_name.to_s.first(100).presence, last_used_at: Time.current)
    token
  end

  def revoke_all_tokens!(except_jti: nil)
    scope = allowlisted_jwts
    scope = scope.where.not(jti: except_jti) if except_jti
    scope.delete_all
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

  # Admin web sessions only (parents use tokens, see AllowlistedJwt).
  def timeout_in = 12.hours

  # Devise emails go through Active Job.
  def send_devise_notification(notification, *args)
    devise_mailer.send(notification, self, *args).deliver_later
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
