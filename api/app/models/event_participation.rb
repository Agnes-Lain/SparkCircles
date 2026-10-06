# A parent's spot in an event (AC-5.2): numbers only; one place per person attending.
# `places` is a generated column (adults + children). Joining, requests and leaving go
# through Events::Participations, which keeps events.places_taken in step.
#
# US-17: with host approval a join is a request ("pending", no places held) until the host
# accepts or declines it (AC-17.14 to AC-17.16). Only "accepted" rows hold places. An
# accepted participant asking for more places keeps them and carries the new totals in
# pending_adults/pending_children until the host decides (AC-17.21).
class EventParticipation < ApplicationRecord
  include EncryptedPersonalData

  STATUSES = %w[pending accepted declined withdrawn expired closed].freeze
  CLOSED_REASONS = %w[full cancelled verification].freeze
  # AC-17.19: an unanswered request expires 48 hours after it was sent, or at the start.
  REQUEST_LIFETIME = 48.hours

  personal_data :emergency_phone

  belongs_to :event, inverse_of: :participations
  belongs_to :user

  normalizes :emergency_phone, with: ->(value) { PhoneNumber.normalize(value) || value.strip.presence }

  scope :accepted, -> { where(status: "accepted") }
  scope :pending, -> { where(status: "pending") }
  # Requests waiting for the host: new requests and requests for extra places.
  scope :awaiting_host, -> { where(status: "pending").or(where(status: "accepted").where.not(pending_adults: nil)) }
  scope :arrival_order, -> { order(:requested_at, :id) }

  validates :adults, numericality: { only_integer: true }
  validates :children, numericality: { only_integer: true }
  validates :status, inclusion: { in: STATUSES }
  validates :closed_reason, inclusion: { in: CLOSED_REASONS, allow_nil: true }
  validate :counts_in_range
  validate :emergency_phone_given

  def requested_places = adults.to_i + children.to_i
  def pending? = status == "pending"
  def accepted? = status == "accepted"
  def declined? = status == "declined"
  def pending_change? = accepted? && !pending_adults.nil?
  def awaiting_host? = pending? || pending_change?
  def pending_places = pending_adults.to_i + pending_children.to_i

  # The places the host is asked for: the whole request, or the extra places.
  def asked_places = pending_change? ? pending_places - requested_places : requested_places

  def expires_at
    return nil unless awaiting_host? && requested_at

    [ requested_at + REQUEST_LIFETIME, event.starts_at ].compact.min
  end

  def expired_now? = expires_at.present? && expires_at <= Time.current

  private

  # AC-5.2, AC-17.2: at least one adult, except on a drop-off event, which needs at least
  # one child instead.
  def counts_in_range
    return unless adults.is_a?(Integer) && children.is_a?(Integer)

    if event&.dropoff?
      errors.add(:adults, :out_of_range) if adults.negative?
      errors.add(:children, :too_few) if children < 1
    else
      errors.add(:adults, :too_few) if adults < 1
    end
    errors.add(:children, :out_of_range) if children.negative?
    errors.add(:adults, :out_of_range) if requested_places > Event::PLACES.max
  end

  # AC-17.7, AC-17.10, AC-17.11: required with 0 adults, optional otherwise, always checked.
  def emergency_phone_given
    if emergency_phone.blank?
      errors.add(:emergency_phone, :blank) if event&.dropoff? && adults == 0 && (accepted? || pending?)
    elsif !PhoneNumber.valid?(emergency_phone)
      errors.add(:emergency_phone, :invalid)
    end
  end
end
