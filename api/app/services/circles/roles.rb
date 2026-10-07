module Circles
  # Admins (spec circles US-6): an admin with rights may make a verified member co-admin
  # (3 admins at most, AC-6.1); an admin may step down if another admin exists (AC-6.3).
  class Roles
    def initialize(circle)
      @circle = circle
    end

    def promote!(membership, by:)
      Circle.transaction do
        @circle.lock!
        membership.lock!
        raise Error.new(:not_found, status: :not_found) unless membership.active? && !membership.user.closed?
        raise Error.new(:already_admin) if membership.admin?
        raise Error.new(:not_verified_member) unless membership.user.verified?
        raise Error.new(:admin_limit) if @circle.admins.count >= Circle::MAX_ADMINS

        membership.update!(role: "admin", admin_since: Time.current)
        Audit.record!("circle_admin_promoted", @circle, actor: by, subject: membership.user)
      end
    end

    # The creator's "Admin" label moves to the longest-standing remaining admin.
    def step_down!(membership)
      Circle.transaction do
        @circle.lock!
        membership.lock!
        raise Error.new(:forbidden, status: :forbidden) unless membership.admin?

        others = @circle.admins.where.not(id: membership.id).order(:admin_since, :joined_at, :id)
        raise Error.new(:sole_admin) if others.none?

        others.first.update!(creator: true) if membership.creator?
        membership.update!(role: "member", creator: false, admin_since: nil)
        Audit.record!("circle_admin_stepped_down", @circle, actor: membership.user, subject: membership.user)
      end
    end
  end
end
