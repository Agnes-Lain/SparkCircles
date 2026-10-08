module Circles
  # Who runs a circle when its admins can't (spec circles AC-6.4, AC-6.5 revised 2026-10-08).
  #
  # - An admin who loses verification keeps the role without rights while another admin
  #   with rights exists ("the next admin takes over").
  # - With no admin with rights left, the longest-standing verified member becomes admin and
  #   is told by e-mail (as AC-6.4). The unverified admins step back to member and are marked
  #   as former admins.
  # - With no verified member, nothing changes: the circle takes no requests, leaves search
  #   and members see a notice (backlog #38). The first member to get verified becomes admin.
  # - A former admin who is verified again returns as co-admin if there is room (max 3).
  #
  # Called after a user's verification changes (User#sync_events) and, for account closure,
  # by Circles::Departure#leave_for_closure!.
  class Succession
    def self.verification_changed!(user)
      return if user.closed?

      user.circle_memberships.active.includes(:circle).find_each do |membership|
        new(membership.circle).verification_changed!(membership)
      end
    end

    def initialize(circle)
      @circle = circle
    end

    def verification_changed!(membership)
      return if @circle.closed?

      successor = Circle.transaction do
        @circle.lock!
        membership.reload
        next unless membership.active?

        membership.user.verified? ? verified!(membership) : unverified!(membership)
      end
      Notifications.new_admin(successor, reason: :no_verified_admin) if successor
    end

    # AC-6.4, AC-6.5: the longest-standing verified active member (other than `except`) who
    # isn't admin becomes the admin ("Admin" label); admins without rights step back. Returns
    # the new admin's membership, or nil. Runs inside the caller's transaction and lock.
    def hand_over!(except: nil)
      candidates = @circle.active_memberships.where(role: "member").where.not(id: except&.id)
      successor = candidates.includes(:user).seniority.find { |other| other.user.verified? }
      return unless successor

      now = Time.current
      @circle.admins.where.not(id: except&.id).includes(:user).reject { |admin| admin.user.verified? }.each do |admin|
        admin.update!(role: "member", creator: false, admin_since: nil, former_admin_at: now)
      end
      successor.update!(role: "admin", creator: true, admin_since: now, former_admin_at: nil)
      Audit.record!("circle_admin_succession", @circle, subject: successor.user)
      successor
    end

    private

    def unverified!(membership)
      return unless membership.admin?
      return if @circle.managed?

      hand_over!
    end

    def verified!(membership)
      successor = @circle.managed? ? nil : hand_over!
      membership.reload
      return_as_co_admin!(membership) if membership.former_admin_at && !membership.admin?
      successor
    end

    def return_as_co_admin!(membership)
      if @circle.admins.count < Circle::MAX_ADMINS
        membership.update!(role: "admin", admin_since: Time.current, former_admin_at: nil)
        Audit.record!("circle_admin_promoted", @circle, subject: membership.user)
      else
        membership.update!(former_admin_at: nil)
      end
    end
  end
end
