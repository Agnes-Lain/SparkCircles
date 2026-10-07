module Circles
  # The viewer's own status on a public page, a search result or an invitation preview
  # (AC-17.13): never anyone else's. A blocked person (declined or removed) looks like
  # anyone else and may "ask" again (nothing is created, AC-2.7).
  module ViewerStatus
    module_function

    def for(circle, user)
      return { status: "none", can_request: false, request_blocker: "account_required" } if user.nil?

      membership = circle.membership_for(user)
      return { status: "member", can_request: false, request_blocker: "member" } if membership&.active?
      return { status: "pending", can_request: false, request_blocker: "pending" } if membership&.pending?

      blocker = if circle.full? then "full"
      elsif Requests.circles_count(user) >= Circle::MAX_CIRCLES_PER_PARENT then "member_limit"
      end
      { status: "none", can_request: blocker.nil?, request_blocker: blocker }
    end
  end
end
