module Events
  # Event notification emails (docs/design/events-emails.md, E1 to E7), batched with
  # PendingEventNotification rows and DeliverEventNotificationsJob:
  #
  # - E1 host activity: joins, place changes and leaves, one email per event 15 minutes
  #   after the first action, net per participant (join then leave shows nothing). After a
  #   digest, the next one for that event waits at least an hour. Removals by the system
  #   (closure, erasure, revoked verification) show as an anonymous count ("1 person
  #   left"): no name, no id kept in the batch, no reason (PM decision 2026-10-06).
  # - E2 event changed: one email per participant 10 minutes after the first edit, with the
  #   net difference since before that edit (nothing if it was reverted).
  # - E4 to E7 hold and resume: one email per participant for all of a host's events, one
  #   per host; a hold undone before sending sends nothing. A back-office suspension sends
  #   E4 to participants only (the host's E5 is about verification).
  # - E3, E3b cancellations: sent at once, never batched. Requesters whose pending request
  #   the cancellation closed get the neutral E3b (US-17, PM decision 2026-10-06).
  # - US-17 requests: a new request joins the host's E1 digest (E-A); accepted, declined,
  #   expired and closed-as-full go to the parent at once (E-B to E-E), an expiry found
  #   during quiet hours waits for 08:00. Requests closed for lost verification send nothing.
  # - Quiet hours 22:00 to 08:00 Paris for everything batched, except E2 for an event
  #   starting within 24 hours and anything about an event starting before 08:00.
  #
  # Privacy: the batches and the mailer never get the exact address (only a keyed digest
  # to tell that it changed), never adults/children, never why a host lost verification.
  module Notifications
    HOST_ACTIVITY_WINDOW = 15.minutes
    BUSY_EVENT_GAP = 1.hour
    EDIT_WINDOW = 10.minutes
    STATUS_WINDOW = 1.minute
    URGENT_EDIT = 24.hours
    TRACKED_FIELDS = %w[title starts_at ends_at area exact_address places_total].freeze

    module_function

    # ---- Recording (called after the change is committed) ----

    # E1. `from` and `to` are the participant's places before and after (0 = not joined).
    def participation_changed(event, user, from:, to:)
      return if from == to || event.host.nil?

      update_batch(:host_activity, event: event) do |batch|
        entries = batch.payload.fetch("entries", [])
        entry = entries.find { |item| item["user_id"] == user.id && !item["request"] }
        entry ? entry["to"] = to : entries << { "user_id" => user.id, "from" => from, "to" => to }
        batch.payload = batch.payload.merge("entries" => entries.reject { |item| !item["request"] && item["from"] == item["to"] })
        batch.deliver_at ||= [ Time.current + HOST_ACTIVITY_WINDOW, batch.throttle_until ].compact.max
      end
    end

    # E-A (AC-17.25): a request joins the host's digest. `places` is what is asked (the
    # extra places for an accepted participant, with the new `total`).
    def request_received(event, user, places:, total: nil)
      return if event.host.nil?

      update_batch(:host_activity, event: event) do |batch|
        entries = batch.payload.fetch("entries", []).reject { |item| item["user_id"] == user.id && item["request"] }
        entries << { "user_id" => user.id, "request" => true, "places" => places, "total" => total }.compact
        batch.payload = batch.payload.merge("entries" => entries)
        batch.deliver_at ||= [ Time.current + HOST_ACTIVITY_WINDOW, batch.throttle_until ].compact.max
      end
    end

    # A request decided, withdrawn, expired or closed before the digest went out leaves it.
    def request_resolved(event, user)
      batch = PendingEventNotification.find_by(kind: "host_activity", event_id: event.id)
      return unless batch

      batch.with_lock do
        entries = batch.payload.fetch("entries", [])
        kept = entries.reject { |item| item["user_id"] == user.id && item["request"] }
        batch.update!(payload: batch.payload.merge("entries" => kept)) if kept.size != entries.size
      end
    end

    # E-B to E-E, to the parent at once. `kind`: :request_accepted, :request_declined,
    # :request_expired or :request_closed_full.
    def request_decided(kind, event, user, **options)
      return if user.closed? || !user.confirmed?

      mail = EventMailer.public_send(kind, event, user, **options)
      wait = kind == :request_expired ? deferred_until_morning(event) : nil
      wait ? mail.deliver_later(wait_until: wait) : mail.deliver_later
    end

    # E1, AC-8.5, AC-8.6 and erasure: the participant is gone for a reason the host is not
    # told. Their entry leaves the batch (no id kept): a net join drops out, anything else
    # becomes one anonymous "left" in the count.
    # `held`: whether the person held places (a request alone leaves no trace).
    def participant_removed(event, user, held: true)
      return if event.host_id.nil?

      update_batch(:host_activity, event: event) do |batch|
        entries = batch.payload.fetch("entries", [])
        mine = entries.select { |item| item["user_id"] == user.id }
        entry = mine.find { |item| !item["request"] }
        removed = batch.payload.fetch("removed", 0)
        removed += 1 if held && !(entry && entry["from"].zero?)
        batch.payload = { "entries" => entries - mine, "removed" => removed }
        batch.deliver_at ||= [ Time.current + HOST_ACTIVITY_WINDOW, batch.throttle_until ].compact.max
      end
    end

    # BUG-11: on erasure, no pending host digest keeps the person's id.
    def forget_participant(user)
      PendingEventNotification.where(kind: "host_activity")
                              .where("payload -> 'entries' @> ?::jsonb", [ { user_id: user.id } ].to_json)
                              .includes(:event).find_each do |batch|
        next unless batch.event

        mine = batch.payload.fetch("entries", []).select { |item| item["user_id"] == user.id }
        held = mine.any? { |item| !item["request"] } || EventParticipation.accepted.exists?(event_id: batch.event_id, user_id: user.id)
        participant_removed(batch.event, user, held: held)
      end
    end

    # The state an edit is compared with. No address: a keyed digest only.
    def snapshot(event)
      {
        "title" => event.title, "starts_at" => event.starts_at&.utc&.iso8601, "ends_at" => event.ends_at&.utc&.iso8601,
        "area" => event.area, "address_digest" => address_digest(event.exact_address), "places_total" => event.places_total
      }
    end

    # E2. `before` is snapshot(event) taken before the edit.
    def event_edited(event, before)
      return unless event.published? || event.suspended?
      return if snapshot(event) == before

      update_batch(:event_changed, event: event) do |batch|
        next if batch.deliver_at # inside a window: keep the state before the first edit

        batch.payload = { "before" => before }
        batch.deliver_at = Time.current + EDIT_WINDOW
      end
    end

    # E4 to E7. `state` is "on_hold" or "resumed".
    def host_status_changed(host, events, state)
      return if events.empty?

      update_batch(:host_status, host: host) do |batch|
        states = batch.payload.fetch("events", {})
        events.each do |event|
          previous = states[event.id]
          previous && previous != state ? states.delete(event.id) : states[event.id] = state
        end
        batch.payload = { "events" => states }
        batch.deliver_at ||= Time.current + STATUS_WINDOW
      end
    end

    # E3 (host cancelled) or E3b (neutral: closure, start while on hold, back office).
    # Never delayed. Pending batches about the event are dropped.
    def event_cancelled(event, neutral:)
      PendingEventNotification.where(event_id: event.id).delete_all
      forget_status(event)
      recipients(event).each { |user| EventMailer.event_cancelled(event, user, neutral: neutral).deliver_later }
      requesters_closed_by_cancellation(event).each { |user| EventMailer.event_cancelled(event, user, neutral: true).deliver_later }
    end

    # ---- Delivery (DeliverEventNotificationsJob) ----

    def deliver(batch)
      batch.with_lock do
        if batch.deliver_at.nil? || batch.deliver_at > Time.current + 1.second
          nil # sent already, or moved to a later time (another job is scheduled)
        elsif (later = deferred_until(batch))
          batch.update!(deliver_at: later)
          enqueue(batch)
        else
          send(:"deliver_#{batch.kind}", batch)
        end
      end
    end

    # Quiet hours for a single parent email: 08:00 unless the event starts before then.
    def deferred_until_morning(event, now = Time.current)
      return nil unless QuietHours.quiet?(now)

      morning = QuietHours.next_morning(now)
      event.starts_at && event.starts_at < morning ? nil : morning
    end

    def deferred_until(batch, now = Time.current)
      return nil unless QuietHours.quiet?(now)

      morning = QuietHours.next_morning(now)
      starts = batch_events(batch).map(&:starts_at)
      limit = batch.kind == "event_changed" ? now + URGENT_EDIT : morning
      starts.any? { |time| time < limit } ? nil : morning
    end

    # A person closed or erased since their entry was recorded is never named: a leave
    # counts as an anonymous "left", a join drops out.
    def deliver_host_activity(batch)
      event = batch.event
      people = active_users(batch)
      waiting = event.all_participations.awaiting_host.pluck(:user_id).to_set
      removed = batch.payload.fetch("removed", 0)
      entries = batch.payload.fetch("entries", []).filter_map do |entry|
        person = people[entry["user_id"]]
        if entry["request"]
          # Only requests still waiting (E-A); never the adults/children split.
          next unless person && waiting.include?(person.id)

          next { "user" => person, "request" => true, "places" => entry["places"], "total" => entry["total"] }
        end
        removed += 1 if person.nil? && entry["from"].positive?
        person && { "user" => person, "from" => entry["from"], "to" => entry["to"] }
      end
      count = entries.size + removed
      if count.positive? && event.host && notifiable_host?(event.host) && (event.published? || event.suspended?) && !event.ended?
        EventMailer.host_activity(event, entries, removed: removed, places_left: event.places_left,
                                                  places_total: event.places_total, waiting: waiting.size).deliver_later
        batch.throttle_until = Time.current + BUSY_EVENT_GAP if count > 1
      end
      batch.update!(payload: {}, deliver_at: nil)
    end

    def deliver_event_changed(batch)
      event = batch.event
      before = batch.payload["before"]
      after = snapshot(event)
      if before && changes?(before, after) && (event.published? || event.suspended?) && !event.ended?
        recipients(event).each { |user| EventMailer.event_changed(event, user, before, after).deliver_later }
      end
      batch.destroy!
    end

    def deliver_host_status(batch)
      states = batch.payload.fetch("events", {})
      events = Event.where(id: states.keys).upcoming_for_host.includes(:host).to_a
      on_hold = events.select { |event| states[event.id] == "on_hold" && event.suspended? }
      resumed = events.select { |event| states[event.id] == "resumed" && event.published? }
      notify_status(batch.host, on_hold, :on_hold)
      notify_status(batch.host, resumed, :resumed)
      batch.destroy!
    end

    # E4 for a back-office suspension (participants only, same window and quiet hours).
    def event_suspended_by_admin(event)
      host_status_changed(event.host, [ event ], "on_hold") if event.host
    end

    # Only the changes participants are told about: title, time, place; a places change
    # only with another change (PM decision: their own spot is never affected).
    def changes?(before, after)
      (%w[title starts_at ends_at area address_digest] - same_keys(before, after)).any?
    end

    def same_keys(before, after) = before.keys.select { |key| before[key] == after[key] }

    # ---- Helpers ----

    def update_batch(kind, event: nil, host: nil)
      batch = PendingEventNotification.create_or_find_by!(kind: kind.to_s, event_id: event&.id, host_id: host&.id)
      batch.with_lock do
        scheduled = batch.deliver_at
        yield batch
        batch.save!
        enqueue(batch) if batch.deliver_at && batch.deliver_at != scheduled
      end
    end

    def enqueue(batch)
      DeliverEventNotificationsJob.set(wait_until: batch.deliver_at).perform_later(batch.id)
    end

    def notify_status(host, events, state)
      return if events.empty?

      by_user = Hash.new { |hash, user| hash[user] = [] }
      events.each { |event| recipients(event).each { |user| by_user[user] << event } }
      by_user.each do |user, list|
        mail = state == :on_hold ? EventMailer.event_on_hold(user, list) : EventMailer.event_resumed(user, list)
        mail.deliver_later
      end
      events = events.reject { |event| event.suspension_reason == "admin" } if state == :on_hold
      return unless host && notifiable_host?(host) && events.any?

      mail = state == :on_hold ? EventMailer.events_on_hold_host(host, events) : EventMailer.events_resumed_host(host, events)
      mail.deliver_later
    end

    def forget_status(event)
      return unless event.host_id

      batch = PendingEventNotification.find_by(kind: "host_status", host_id: event.host_id)
      return unless batch

      batch.with_lock { batch.update!(payload: { "events" => batch.payload.fetch("events", {}).except(event.id) }) }
    end

    def batch_events(batch)
      case batch.kind
      when "host_status" then Event.where(id: batch.payload.fetch("events", {}).keys).to_a
      else [ batch.event ].compact
      end
    end

    # Joined participants who can still receive email (not the host, not closed).
    def recipients(event)
      User.where(id: event.participations.select(:user_id)).where.not(id: event.host_id)
          .where(closed_at: nil).where.not(confirmed_at: nil).order(:id).to_a
    end

    def requesters_closed_by_cancellation(event)
      User.where(id: event.all_participations.where(status: "closed", closed_reason: "cancelled").select(:user_id))
          .where.not(id: event.host_id).where(closed_at: nil).where.not(confirmed_at: nil).order(:id).to_a
    end

    def active_users(batch)
      ids = batch.payload.fetch("entries", []).map { |entry| entry["user_id"] }
      User.where(id: ids, closed_at: nil).index_by(&:id)
    end

    def notifiable_host?(host) = host.confirmed? && !host.closed?

    def address_digest(address)
      key = Rails.application.key_generator.generate_key("event-address-digest", 32)
      OpenSSL::HMAC.hexdigest("SHA256", key, address.to_s).first(32)
    end
  end
end
