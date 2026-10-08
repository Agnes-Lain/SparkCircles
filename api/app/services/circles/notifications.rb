module Circles
  # Circle e-mails (spec circles AC-2.4 to AC-2.6, AC-6.4, AC-16.5; copy in design section 5).
  #
  # Join requests (AC-2.4): the first request sends one e-mail to each admin with rights at
  # once; requests arriving within the next hour are grouped into one e-mail sent when that
  # hour ends (DeliverCircleRequestDigestJob). Nothing is sent to closed or unconfirmed
  # accounts. No e-mail carries more than the recipient may see in the app.
  module Notifications
    REQUEST_GROUPING = 1.hour

    module_function

    def request_received(circle, requester)
      circle.with_lock do
        last = circle.last_request_email_at
        if last.nil? || last <= REQUEST_GROUPING.ago
          circle.update_columns(last_request_email_at: Time.current, request_digest_due_at: nil)
          admins(circle).each { |admin| CircleMailer.request_received(circle, admin, requester).deliver_later }
        elsif circle.request_digest_due_at.nil?
          due = last + REQUEST_GROUPING
          circle.update_columns(request_digest_due_at: due)
          DeliverCircleRequestDigestJob.set(wait_until: due).perform_later(circle)
        end
      end
    end

    # The grouped e-mail: the requests that arrived since the last e-mail and still wait.
    def deliver_request_digest(circle)
      circle.with_lock do
        return if circle.request_digest_due_at.nil? || circle.request_digest_due_at > Time.current

        since = circle.last_request_email_at
        count = circle.memberships.pending.where(requested_at: since..).count
        circle.update_columns(request_digest_due_at: nil, last_request_email_at: Time.current)
        next if count.zero? || !circle.active?

        admins(circle).each { |admin| CircleMailer.requests_digest(circle, admin, count).deliver_later }
      end
    end

    def request_accepted(membership) = to_person(membership.user) { CircleMailer.request_accepted(membership.circle, membership.user) }
    def request_declined(membership) = to_person(membership.user) { CircleMailer.request_declined(membership.circle, membership.user) }
    def request_expired(membership) = to_person(membership.user) { CircleMailer.request_expired(membership.circle, membership.user) }

    # AC-16.5: "You can no longer attend « … »: you left the circle / you're no longer in it."
    def event_access_lost(event, user, reason)
      to_person(user) { CircleMailer.event_access_lost(event, user, reason) }
    end

    # AC-6.4, AC-6.5: the longest-standing verified member became admin. `reason`:
    # :closed_account (AC-6.4) or :no_verified_admin (AC-6.5); never a name.
    def new_admin(membership, reason:)
      to_person(membership.user) { CircleMailer.new_admin(membership.circle, membership.user, reason.to_s) }
    end

    # AC-6.4: no verified member left to run the circle; it closes in 30 days.
    def closing(circle)
      circle.active_memberships.includes(:user).each do |membership|
        to_person(membership.user) { CircleMailer.circle_closing(circle, membership.user) }
      end
    end

    def admins(circle) = circle.admins_with_rights.map(&:user).select { |user| reachable?(user) }

    def to_person(user)
      yield.deliver_later if reachable?(user)
    end

    def reachable?(user) = user.confirmed? && !user.closed?
  end
end
