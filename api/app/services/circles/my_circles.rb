module Circles
  # The "My circles" list (spec circles AC-9.1 to AC-9.3, AC-3.6, AC-2.6; design C1):
  # circles I'm in, my pending and expired requests, and neutral cards (declined, removed,
  # paused, closed) until I hide them. Neutral cards carry no circle data, except the name
  # on a declined request (the person already knew it; PM phone test 2026-10-07).
  class MyCircles
    Item = Data.define(:membership, :state)

    def initialize(user)
      @user = user
    end

    def self.created_count(user) = Circle.where(created_by_id: user.id).where.not(status: "closed").count

    def items
      rows = @user.circle_memberships.where(dismissed_at: nil).where(status: %w[active pending expired declined removed])
                  .includes(:circle).to_a
      items = rows.filter_map { |membership| Item.new(membership: membership, state: state_for(membership)) }
      member, others = items.partition { |item| item.state == "member" }
      requests = requests_counts(member.map(&:membership))
      @requests_counts = requests
      member.sort_by! { |item| [ requests[item.membership.circle_id].to_i.positive? ? 0 : 1, item.membership.circle.name.downcase ] }
      others.sort_by! { |item| [ %w[pending expired].index(item.state) || 2, item.membership.updated_at ] }
      member + others
    end

    def requests_count(membership) = @requests_counts.to_h[membership.circle_id].to_i

    def limits
      created = self.class.created_count(@user)
      circles = Requests.circles_count(@user)
      { created: created, max_created: Circle::MAX_CREATED_PER_PARENT, circles: circles,
        max_circles: Circle::MAX_CIRCLES_PER_PARENT,
        can_create: @user.verified? && created < Circle::MAX_CREATED_PER_PARENT && circles < Circle::MAX_CIRCLES_PER_PARENT }
    end

    private

    def state_for(membership)
      circle = membership.circle
      case membership.status
      when "removed", "declined" then membership.status
      when "pending", "expired" then circle.active? ? membership.status : nil
      else
        return "closed" if circle.closed?
        return "paused" if circle.suspended?

        "member"
      end
    end

    # Requests to answer, for the circles where I'm an admin with rights.
    def requests_counts(memberships)
      ids = memberships.select(&:admin?).map(&:circle_id)
      return {} if ids.empty? || !@user.verified?

      CircleMembership.pending.where(circle_id: ids).group(:circle_id).count
    end
  end
end
