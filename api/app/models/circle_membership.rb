# One person in one circle (spec circles US-2 to US-6): a join request ("pending") until an
# admin decides, then "active". Rows are never duplicated (one per circle and person):
#
# - declined, removed: the person stays blocked for this circle (AC-2.7, AC-5.2); using the
#   link again creates nothing and tells them why (PM phone test 2026-10-07).
# - expired (AC-2.6), cancelled (AC-3.6), left (AC-5.1): they may ask again.
#
# `role` is "admin" or "member"; the circle's creator is an admin with `creator` set.
class CircleMembership < ApplicationRecord
  STATUSES = %w[pending active declined expired cancelled left removed].freeze
  BLOCKING = %w[declined removed].freeze
  REQUESTABLE_AGAIN = %w[expired cancelled left].freeze
  # AC-2.6: an unanswered request expires after 30 days.
  REQUEST_LIFETIME = 30.days
  # Spec section 7 (retention proposal): requests 90 days after the decision.
  REQUEST_RETENTION = 90.days

  belongs_to :circle, inverse_of: :memberships
  belongs_to :user

  validates :status, inclusion: { in: STATUSES }
  validates :role, inclusion: { in: %w[member admin] }

  scope :active, -> { where(status: "active") }
  scope :pending, -> { where(status: "pending") }
  # Families: active rows of accounts that aren't closed (a closed account leaves at once).
  scope :active_members, -> { active.joins(:user).where(users: { closed_at: nil }) }
  scope :admins, -> { where(role: "admin") }
  scope :seniority, -> { order(:joined_at, :id) }

  def pending? = status == "pending"
  def active? = status == "active"
  def admin? = active? && role == "admin"
  def blocking? = BLOCKING.include?(status)
  def admin_rights? = admin? && user.verified?

  # The role as the design names it: "Admin" for the creator, "Co-admin" for other admins.
  def display_role
    return "member" unless admin?

    creator? ? "admin" : "co_admin"
  end

  def expires_at = pending? && requested_at ? requested_at + REQUEST_LIFETIME : nil
end
