# An event hosted by a verified parent (spec events, US-1 to US-9).
#
# `source` is "hosted" in v1. v2 imports public open-data events into this table
# (`source: "open_data"`, `external_id`, `source_url`, no host), so search always runs
# on our own store (AC-10.10). v3 recurrence links occurrences through `series_id`, each
# occurrence staying a separate event (AC-13.3) in its `time_zone` (AC-13.6).
class Event < ApplicationRecord
  include EncryptedPersonalData

  CATEGORIES = %w[sport outdoors board_games video_games crafts music shows books workshops playdates other].freeze
  STATUSES = %w[draft published suspended cancelled past].freeze
  JOIN_RULES = %w[anyone verified_only].freeze
  # AC-16.1: the language the host wrote the event in (never translated, AC-16.4).
  LANGUAGES = %w[fr en].freeze
  # US-16 (circles spec, delivers events US-14): "circles" = visible to chosen circles only.
  VISIBILITIES = %w[searchable circles].freeze
  AGE_BANDS = { "0-2" => 0..2, "3-5" => 3..5, "6-8" => 6..8, "9-12" => 9..12, "13+" => 13..17 }.freeze
  AGES = 0..17
  PLACES = 1..100
  MAX_DURATION = 24.hours
  RETENTION = 90.days
  TITLE_MAX = 80
  DESCRIPTION_MAX = 1000
  ADDRESS_MAX = 200
  # AC-2.5, AC-7.2, AC-17.1, AC-17.13: what a host may no longer change once the event is published.
  LOCKED_AFTER_PUBLISH = %w[join_rule visibility category adult_required approval_required].freeze
  # AC-17.9, AC-17.12: accepted participants see the host's phone until 24 hours after the end.
  PHONE_VISIBLE_AFTER_END = 24.hours

  personal_data :exact_address, :host_phone

  belongs_to :host, class_name: "User", optional: true, inverse_of: :hosted_events
  # Accepted participations only: the people who hold places (AC-17.15).
  has_many :participations, -> { where(status: "accepted") }, class_name: "EventParticipation", inverse_of: :event
  # Every row, requests included (pending, declined, withdrawn, expired, closed).
  has_many :all_participations, class_name: "EventParticipation", dependent: :delete_all, inverse_of: false
  has_many :reports, class_name: "EventReport", dependent: :delete_all, inverse_of: :event
  has_many :event_circles, dependent: :delete_all
  has_many :circles, through: :event_circles

  normalizes :title, with: ->(value) { value.squish.presence }
  normalizes :description, with: ->(value) { value.strip.presence }
  normalizes :exact_address, with: ->(value) { value.squish.presence }
  normalizes :tags, with: ->(value) { EventTag.normalize_list(value) }
  # AC-17.11: stored in E.164 when accepted; anything else is kept as typed and refused.
  normalizes :host_phone, with: ->(value) { PhoneNumber.normalize(value) || value.strip.presence }

  # AC-17.3: a drop-off event is always "verified members only", whatever is sent.
  # The host's phone exists only for a drop-off event (AC-17.9).
  before_validation do
    self.join_rule = "verified_only" if dropoff?
    self.host_phone = nil unless dropoff?
  end

  # BUG-8 (PM decision 2026-10-06): a draft saves whatever the host typed. What is typed
  # is still checked (lengths, ranges, order); every field is required at publish.
  validates :title, :category, :area, :starts_at, :ends_at, presence: true, unless: :draft?
  validates :exact_address, :places_total, presence: true, if: -> { hosted? && !draft? }
  validates :title, length: { maximum: TITLE_MAX }
  validates :description, length: { maximum: DESCRIPTION_MAX }
  validates :category, inclusion: { in: CATEGORIES, allow_blank: true }
  validates :status, inclusion: { in: STATUSES }
  validates :join_rule, inclusion: { in: JOIN_RULES }
  validates :language, presence: true, inclusion: { in: LANGUAGES, allow_blank: true }
  validates :visibility, inclusion: { in: VISIBILITIES }
  validates :area, inclusion: { in: ->(_) { EventArea.keys }, allow_blank: true }
  validates :exact_address, length: { maximum: ADDRESS_MAX }
  # Checked on the value as sent: 1.5 is refused (not_an_integer), never truncated to 1.
  validates :places_total, :age_min, :age_max, numericality: { only_integer: true }, allow_nil: true
  validate :places_within_range
  validate :ages_within_range
  validate :times_in_order
  validate :starts_in_future, if: :start_must_be_future?
  validate :tags_allowed
  validate :locked_fields_unchanged, if: -> { persisted? && status_in_database != "draft" }
  validates :adult_required, :approval_required, inclusion: { in: [ true, false ] }
  # AC-17.4: a drop-off event needs an age range and the host's phone to be published.
  validates :age_min, :age_max, :host_phone, presence: true, if: -> { dropoff? && !draft? }
  validate :host_phone_accepted
  validate :circles_allowed
  after_save :save_chosen_circles

  scope :hosted, -> { where(source: "hosted") }
  scope :not_ended, -> { where(ends_at: Time.current..) }
  scope :ended, -> { where(ends_at: ...Time.current) }
  # AC-1.4, AC-1.6, AC-3.6, AC-8.2: what search shows (full events included, marked full).
  scope :listed, -> { hosted.where(status: "published").not_ended }
  scope :upcoming_for_host, -> { where(starts_at: Time.current..) }
  scope :soonest_first, -> { order(:starts_at, :id) }
  scope :expired, -> { where(ends_at: ...RETENTION.ago) }

  attr_accessor :publishing
  # US-16: the circles sent with the form, saved with the event (see circles_allowed).
  attr_reader :chosen_circle_ids

  def chosen_circle_ids=(ids)
    @chosen_circle_ids = Array(ids).map(&:to_s).compact_blank.uniq
  end

  def hosted? = source == "hosted"
  def draft? = status == "draft"
  def published? = status == "published"
  def suspended? = status == "suspended"
  def cancelled? = status == "cancelled"
  def started? = starts_at.present? && starts_at <= Time.current
  def ended? = ends_at.present? && ends_at <= Time.current

  # "past" as soon as it ends, even before the hourly job updates the column.
  def display_status = published? && ended? ? "past" : status

  # AC-8.2: a host's events disappear the moment their verification stops (expiry at
  # midnight, closure), not only when the daily job suspends them. The expiry date is
  # encrypted, so this is checked in Ruby (Events::Search filters each page with it).
  def listed? = hosted? && published? && !ended? && host_in_good_standing?
  def joinable? = listed?
  def host_in_good_standing? = host.present? && host.verified? && !host.closed?
  # AC-17.23, AC-8.2: no decision on requests while suspended, or once the host's
  # verification has lapsed (even before the daily job suspends the event).
  def requests_frozen? = suspended? || (published? && !host_in_good_standing?)
  def places_left = [ places_total.to_i - places_taken, 0 ].max
  def full? = hosted? && places_left.zero?
  def verified_only? = join_rule == "verified_only"
  def hosted_by?(user) = user.present? && host_id == user.id
  def editable? = draft? || (published? && !ended?)
  # AC-17.1, AC-17.2: "accompanying adult optional" makes a drop-off event.
  def dropoff? = adult_required == false
  def phone_visible_until = ends_at && ends_at + PHONE_VISIBLE_AFTER_END
  def phone_visible? = phone_visible_until.present? && Time.current < phone_visible_until
  # US-16: visible to the members of the chosen circles only (AC-16.3).
  def circle_only? = visibility == "circles"

  # The chosen circles' ids, as sent with the form or as saved.
  def circle_id_list = chosen_circle_ids || event_circles.map(&:circle_id)

  # AC-1.5, AC-1.6: verification is checked again when publishing; the start must be ahead.
  def publish!
    self.publishing = true
    self.status = "published"
    self.published_at = Time.current
    save
  end

  # AC-8.2: suspended and hidden from search; participants see "on hold".
  def suspend!(reason)
    update_columns(status: "suspended", suspension_reason: reason, suspended_at: Time.current, updated_at: Time.current)
  end

  # AC-8.3: resumes when the host is verified again before the start.
  def resume!
    update_columns(status: "published", suspension_reason: nil, suspended_at: nil, updated_at: Time.current)
  end

  # AC-17.23: pending requests are closed (the requesters get the neutral cancellation
  # email); AC-17.12: emergency numbers are erased at once.
  def cancel!
    now = Time.current
    transaction do
      update_columns(status: "cancelled", cancelled_at: now, updated_at: now)
      all_participations.pending.update_all(status: "closed", closed_reason: "cancelled", decided_at: now, updated_at: now)
      all_participations.update_all(emergency_phone: nil, pending_adults: nil, pending_children: nil)
    end
  end

  private

  # A draft's date is checked when it is published; a published event's when it changes.
  def start_must_be_future?
    return false if starts_at.nil?
    return true if publishing

    !draft? && (new_record? || will_save_change_to_starts_at?)
  end

  def places_within_range
    return if places_total.nil?

    if !PLACES.cover?(places_total)
      errors.add(:places_total, :out_of_range)
    elsif places_total < places_taken
      errors.add(:places_total, :below_taken)
    end
  end

  def ages_within_range
    errors.add(:age_min, :out_of_range) if age_min && !AGES.cover?(age_min)
    errors.add(:age_max, :out_of_range) if age_max && !AGES.cover?(age_max)
    errors.add(:age_max, :invalid_range) if age_min && age_max && age_min > age_max
  end

  def times_in_order
    return if starts_at.nil? || ends_at.nil?

    if ends_at <= starts_at
      errors.add(:ends_at, :before_start)
    elsif ends_at - starts_at > MAX_DURATION
      errors.add(:ends_at, :too_long_duration)
    end
  end

  def starts_in_future
    errors.add(:starts_at, :in_past) if starts_at <= Time.current
  end

  def tags_allowed
    errors.add(:tags, :too_many) if tags.size > EventTag::MAX_PER_EVENT
    tags.filter_map { |tag| EventTag.error_for(tag) }.uniq.each do |key|
      # too_short/too_long would otherwise need a %{count} for the default message.
      key.in?(%i[too_short too_long]) ? errors.add(:tags, key, message: :"tag_#{key}") : errors.add(:tags, key)
    end
  end

  def host_phone_accepted
    errors.add(:host_phone, :invalid) if host_phone.present? && !PhoneNumber.valid?(host_phone)
  end

  def locked_fields_unchanged
    LOCKED_AFTER_PUBLISH.each { |field| errors.add(field, :not_editable) if will_save_change_to_attribute?(field) }
    # AC-16.9: the chosen circles can't change after publishing either.
    if chosen_circle_ids && chosen_circle_ids.sort != event_circles.map(&:circle_id).sort
      errors.add(:circle_ids, :not_editable)
    end
  end

  # AC-16.1, AC-16.2, AC-16.10: circles the host is an active member of, at least one to
  # publish; the join rule is "all members of these circles" (stored as "anyone"). A
  # drop-off event stays "verified members only" (events AC-17.3).
  def circles_allowed
    return if host.nil?

    ids = circle_id_list
    unless circle_only?
      errors.add(:circle_ids, :not_allowed) if chosen_circle_ids.present?
      return
    end
    errors.add(:join_rule, :inclusion) if join_rule == "verified_only" && !dropoff?
    errors.add(:circle_ids, :blank) if ids.empty? && !draft?
    return if chosen_circle_ids.nil? || chosen_circle_ids.empty?

    allowed = host.circle_memberships.active.joins(:circle).merge(Circle.active).where(circle_id: chosen_circle_ids).pluck(:circle_id)
    errors.add(:circle_ids, :inclusion) if (chosen_circle_ids - allowed).any?
  end

  def save_chosen_circles
    ids = chosen_circle_ids
    ids = [] if ids.nil? && !circle_only? && event_circles.any?
    return if ids.nil?

    event_circles.where.not(circle_id: ids).delete_all
    (ids - event_circles.reload.map(&:circle_id)).each { |id| event_circles.create!(circle_id: id) }
    event_circles.reset
    @chosen_circle_ids = nil
  end
end
