# A circle: a small group of nearby families (spec circles US-1 to US-9, US-17).
#
# Public by default (PM decision 2026-10-07): discoverable by area and joined by request.
# Private circles are found only through the invitation link or code; they carry the
# premium entitlement flag (free during the test phase, grandfathered when paid plans ship).
# Every join goes through an admin's approval (AC-2.3, AC-17.6). The invitation link token
# and code are encrypted (admins see them again) and looked up by a keyed digest.
class Circle < ApplicationRecord
  include EncryptedPersonalData

  VISIBILITIES = %w[public private].freeze
  STATUSES = %w[active suspended closed].freeze
  NAME_LENGTH = 3..50
  DESCRIPTION_MAX = 200
  # PM decisions 2026-10-06: limits of AC-1.4, AC-3.4, AC-4.5, AC-6.1.
  MAX_FAMILIES = 25
  MAX_CIRCLES_PER_PARENT = 5
  MAX_CREATED_PER_PARENT = 3
  MAX_ADMINS = 3
  # AC-6.4: notice before a circle with no verified member left is closed.
  CLOSING_NOTICE = 30.days
  PRIVATE_ENTITLEMENT = "test_phase_free"
  # 32 symbols (no 0, 1, I, O): 8 characters = 40 bits, protected by the AC-2.8 limit.
  CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".chars.freeze
  CODE_LENGTH = 8

  encrypts :invite_token, :invite_code

  belongs_to :created_by, class_name: "User", optional: true
  has_many :memberships, class_name: "CircleMembership", dependent: :delete_all, inverse_of: :circle
  has_many :reports, class_name: "CircleReport", dependent: :delete_all, inverse_of: :circle
  has_many :event_circles, dependent: :delete_all
  has_many :events, through: :event_circles

  normalizes :name, with: ->(value) { value.squish.presence }
  normalizes :description, with: ->(value) { value.strip.presence }

  before_validation :set_entitlement
  before_validation :generate_invitation, on: :create

  validates :name, presence: true
  validates :name, length: { minimum: NAME_LENGTH.min, maximum: NAME_LENGTH.max, too_short: :too_short, too_long: :too_long },
                   allow_blank: true
  validates :description, length: { maximum: DESCRIPTION_MAX }
  validates :area, presence: true
  validates :area, inclusion: { in: ->(_) { EventArea.keys } }, allow_blank: true
  validates :visibility, inclusion: { in: VISIBILITIES }
  validates :status, inclusion: { in: STATUSES }
  validate :texts_allowed

  scope :active, -> { where(status: "active") }
  scope :listed_public, -> { active.where(visibility: "public") }

  def public? = visibility == "public"
  def private? = visibility == "private"
  def active? = status == "active"
  def suspended? = status == "suspended"
  def closed? = status == "closed"

  # ---- Members (families = active memberships of accounts that aren't closed) ----

  def active_memberships = memberships.active_members
  def families_count = active_memberships.count
  def full? = families_count >= MAX_FAMILIES
  def admins = active_memberships.where(role: "admin")

  # AC-6.5: an admin keeps the role but has rights only while verified.
  def admins_with_rights = admins.includes(:user).select { |membership| membership.user.verified? }
  def managed? = admins_with_rights.any?

  # AC-17.2, AC-17.5, AC-17.8: what search and public pages may show.
  def discoverable? = public? && active? && managed?

  # AC-2.9, AC-6.5: an invitation leads to a request only while someone can approve it.
  def accepting_requests? = active? && managed?

  def membership_for(user) = user && memberships.find_by(user_id: user.id)

  # ---- Invitation (AC-2.1, AC-2.2) ----

  def self.digest(value) = OpenSSL::HMAC.hexdigest("SHA256", digest_key, value.to_s)

  def self.digest_key
    @digest_key ||= Rails.application.key_generator.generate_key("circle-invitation-digest", 32)
  end

  # "k7pm q2xc", "K7PM-Q2XC" → "K7PMQ2XC"
  def self.normalize_code(code) = code.to_s.upcase.gsub(/[^A-Z0-9]/, "")

  def self.find_by_invitation(token: nil, code: nil)
    if token.present?
      find_by(invite_token_digest: digest(token.to_s))
    elsif code.present?
      normalized = normalize_code(code)
      normalized.length == CODE_LENGTH ? find_by(invite_code_digest: digest(normalized)) : nil
    end
  end

  def formatted_code = invite_code && "#{invite_code[0, 4]}-#{invite_code[4, 4]}"

  def renew_invitation!
    generate_invitation
    save!
  end

  private

  def set_entitlement
    self.premium_entitlement = private? ? PRIVATE_ENTITLEMENT : nil
    self.visibility_changed_at = Time.current if will_save_change_to_visibility? && persisted?
  end

  def generate_invitation
    self.invite_token = SecureRandom.urlsafe_base64(16)
    self.invite_token_digest = self.class.digest(invite_token)
    self.invite_code = Array.new(CODE_LENGTH) { CODE_ALPHABET[SecureRandom.random_number(CODE_ALPHABET.size)] }.join
    self.invite_code_digest = self.class.digest(invite_code)
    self.invite_renewed_at = Time.current
  end

  def texts_allowed
    { name: name, description: description }.each do |field, text|
      key = CircleText.error_for(text, banned_words: public?)
      errors.add(field, key) if key
    end
  end
end
