# Event notification emails E1 to E7 (docs/design/events-emails.md), in the recipient's
# language. Batching and quiet hours live in Events::Notifications.
#
# Privacy (section 1 there): never the exact address (the mailer never reads it), never
# adults/children (a number of places only), never why a host lost verification. People
# are "first name + initial" (User#display_name).
class EventMailer < ApplicationMailer
  # An event or person deleted before the email went out (erasure, 90-day purge): drop it.
  class DeliveryJob < ActionMailer::MailDeliveryJob
    discard_on ActiveJob::DeserializationError
  end
  self.delivery_job = DeliveryJob

  MAX_DIGEST_LINES = 8
  MAX_LISTED_TITLES = 3
  SUBJECT_TITLE = 40

  # E1. `entries`: [{ "user", "from", "to" }] net places per participant (0 = not joined),
  # and US-17 requests [{ "user", "request" => true, "places", "total" }] (E-A).
  # `removed`: people gone for a reason the host is not told (closure, erasure, revoked
  # verification), shown as an anonymous count only. `waiting`: requests still waiting.
  def host_activity(event, entries, places_left:, places_total:, removed: 0, waiting: 0)
    host = event.host
    with_recipient(host, event: event) do
      single = entries.size == 1 && removed.zero?
      request = single && entries.first["request"]
      lines = single ? single_activity(entries.first) : digest_activity(entries, removed)
      if request
        lines << t("event_mailer.request_received.waiting_single", count: waiting)
      else
        lines << (places_left.zero? ? t("event_mailer.full") : t("event_mailer.places_left", count: places_left, total: places_total))
        lines << t("event_mailer.request_received.waiting", count: waiting) if waiting.positive?
      end
      action = waiting.positive? ? "event_mailer.request_received.action" : "event_mailer.host_activity.action"
      deliver(host, host_activity_subject(event, entries, removed, single), lines, action: [ action, app_link("events/#{event.id}") ])
    end
  end

  # E-B (AC-17.16, AC-17.25): never the address, never a phone number.
  def request_accepted(event, user, places:)
    with_recipient(user, event: event) do
      lines = t("event_mailer.request_accepted.lines", places: places(places), title: event.title,
                                                       date: event_time(event.starts_at, event), area: area_label(event.area)).dup
      lines << t("event_mailer.request_accepted.dropoff") if event.dropoff?
      deliver(user, t("event_mailer.request_accepted.subject", title: subject_title(event)), lines,
              action: [ "event_mailer.request_accepted.action", app_link("events/#{event.id}") ])
    end
  end

  # E-C: neutral, no host name, no reason.
  # `extra_places`: a request for more places; the places already booked stay (AC-17.21).
  def request_declined(event, user, extra_places: false)
    request_closed(event, user, "request_declined", "events", extra: extra_places ? "extra_places" : nil)
  end

  # E-D
  def request_expired(event, user)
    request_closed(event, user, "request_expired", "events/#{event.id}")
  end

  # E-E: neutral.
  def request_closed_full(event, user)
    request_closed(event, user, "request_closed_full", "events")
  end

  # E2. `before` and `after` are Events::Notifications.snapshot hashes (no address).
  def event_changed(event, user, before, after)
    with_recipient(user, event: event) do
      lines = [ t("event_mailer.event_changed.intro", host: host_name(event)) ]
      lines.concat(change_lines(before, after, event.time_zone))
      lines << t("event_mailer.event_changed.outro")
      deliver(user, t("event_mailer.event_changed.subject", title: subject_title(event)), lines,
              action: [ "event_mailer.event_changed.action", app_link("events/#{event.id}") ])
    end
  end

  # E3 (host cancelled) and E3b (neutral: no host name, no reason).
  def event_cancelled(event, user, neutral: false)
    with_recipient(user) do
      key = neutral ? "event_cancelled_neutral" : "event_cancelled"
      lines = t("event_mailer.#{key}.lines", host: neutral ? nil : host_name(event), date: event_time(event.starts_at, event))
      deliver(user, t("event_mailer.event_cancelled.subject", title: subject_title(event)), lines,
              action: [ "event_mailer.event_cancelled.action", app_link("events") ])
    end
  end

  # E4: one email for all the events of one host that this participant joined.
  def event_on_hold(user, events)
    participant_status(user, events, "event_on_hold")
  end

  # E6
  def event_resumed(user, events)
    participant_status(user, events, "event_resumed")
  end

  # E5: never says why verification ended.
  def events_on_hold_host(host, events)
    host_status(host, events, "events_on_hold_host", "verification")
  end

  # E7
  def events_resumed_host(host, events)
    host_status(host, events, "events_resumed_host", "my-events")
  end

  private

  def request_closed(event, user, key, path, extra: nil)
    with_recipient(user, event: event) do
      lines = t("event_mailer.#{key}.lines", title: event.title).dup
      lines.insert(1, t("event_mailer.#{key}.#{extra}")) if extra
      deliver(user, t("event_mailer.#{key}.subject", title: subject_title(event)), lines,
              action: [ "event_mailer.#{key}.action", app_link(path) ])
    end
  end

  def host_activity_subject(event, entries, removed, single)
    return t("event_mailer.host_activity.digest.subject", count: entries.size + removed, title: subject_title(event)) unless single

    entry = entries.first
    key = entry["request"] ? "request_received" : "host_activity.#{activity_kind(entry)}"
    t("event_mailer.#{key}.subject", guest: entry["user"].display_name, title: subject_title(event))
  end

  def participant_status(user, events, key)
    events = events.sort_by(&:starts_at)
    if events.size == 1
      event = events.first
      with_recipient(user, event: event) do
        deliver(user, t("event_mailer.#{key}.subject", title: subject_title(event)),
                t("event_mailer.#{key}.lines", date: event_time(event.starts_at, event)),
                action: [ "event_mailer.#{key}.action", app_link("events/#{event.id}") ])
      end
    else
      with_recipient(user) do
        deliver(user, t("event_mailer.#{key}.many.subject", titles: title_list(events)), t("event_mailer.#{key}.many.lines"),
                action: [ "event_mailer.#{key}.many.action", app_link("my-events") ])
      end
    end
  end

  def host_status(host, events, key, path)
    with_recipient(host) do
      deliver(host, t("event_mailer.#{key}.subject"), t("event_mailer.#{key}.lines", count: events.size),
              action: [ "event_mailer.#{key}.action", app_link(path) ])
    end
  end

  def with_recipient(user, event: nil)
    I18n.with_locale(user.locale) do
      @title_block = event && { title: event.title, date: event_time(event.starts_at, event) }
      yield
    end
  end

  def deliver(user, subject, lines, action:)
    @greeting = t("account_mailer.greeting", first_name: user.first_name)
    @lines = Array(lines)
    @action_label = t(action.first)
    @action_url = action.last
    mail(to: user.email, subject: subject, template_name: "message")
  end

  def activity_kind(entry)
    if entry["from"].zero? then "join"
    elsif entry["to"].zero? then "leave"
    else "change"
    end
  end

  def single_activity(entry)
    guest = entry["user"].display_name
    return [ request_line(entry, "line") ] if entry["request"]

    [ t("event_mailer.host_activity.#{activity_kind(entry)}.line", guest: guest, from: entry["from"], to: entry["to"],
                                                                     places: places(entry["to"])) ]
  end

  def digest_activity(entries, removed)
    items = entries.first(MAX_DIGEST_LINES).map do |entry|
      next { item: request_line(entry, "digest") } if entry["request"]

      kind = activity_kind(entry)
      count = kind == "leave" ? entry["from"] : entry["to"]
      { item: t("event_mailer.host_activity.digest.#{kind}", guest: entry["user"].display_name,
                                                            from: entry["from"], to: entry["to"], places: places(count)) }
    end
    extra = entries.size - MAX_DIGEST_LINES
    items << { item: t("event_mailer.host_activity.digest.more", count: extra) } if extra.positive?
    items << { item: t("event_mailer.host_activity.digest.removed", count: removed) } if removed.positive?
    [ t("event_mailer.host_activity.digest.intro"), *items ]
  end

  # "Sofia R. demande 3 places", or "… 2 places de plus (3 au total)" ("2 more places") for extra places.
  def request_line(entry, form)
    guest = entry["user"].display_name
    if entry["total"]
      t("event_mailer.request_received.more_#{form}", guest: guest, count: entry["places"], places: places(entry["places"]),
                                                     total: entry["total"])
    else
      t("event_mailer.request_received.#{form}", guest: guest, places: places(entry["places"]))
    end
  end

  def change_lines(before, after, zone)
    labels = "event_mailer.event_changed.labels"
    lines = []
    lines << change(t("#{labels}.title"), before["title"], after["title"]) if before["title"] != after["title"]
    if before["starts_at"] != after["starts_at"]
      lines << change(t("#{labels}.date"), snapshot_start(before, zone), snapshot_start(after, zone))
    elsif before["ends_at"] != after["ends_at"]
      lines << change(t("#{labels}.end_time"), snapshot_end(before, zone), snapshot_end(after, zone))
    end
    if before["area"] != after["area"]
      lines << change(t("#{labels}.place"), area_label(before["area"]), area_label(after["area"]),
                      suffix: t("event_mailer.event_changed.place_hint"))
    elsif before["address_digest"] != after["address_digest"]
      lines << { label: t("#{labels}.place"), text: t("event_mailer.event_changed.address_changed") }
    end
    if lines.any? && before["places_total"] != after["places_total"]
      lines << change(t("#{labels}.places"), before["places_total"], after["places_total"])
    end
    lines
  end

  def change(label, before, after, suffix: nil) = { label: label, before: before.to_s, after: after.to_s, suffix: suffix }

  def snapshot_start(snapshot, zone) = format_time(Time.iso8601(snapshot["starts_at"]).in_time_zone(zone))

  # BUG-12: only the end time when only it changed; the full date if it ends another day.
  def snapshot_end(snapshot, zone)
    starts = Time.iso8601(snapshot["starts_at"]).in_time_zone(zone)
    ends = Time.iso8601(snapshot["ends_at"]).in_time_zone(zone)
    ends.to_date == starts.to_date ? clock(ends) : format_time(ends)
  end

  def event_time(time, event) = format_time(time.in_time_zone(event.time_zone))

  # FR "samedi 12 oct., 14 h 30", EN "Sat 12 Oct, 2:30 pm".
  def format_time(local)
    day = I18n.locale == :fr ? t("date.day_names")[local.wday] : t("date.abbr_day_names")[local.wday]
    "#{day} #{local.day} #{t('date.abbr_month_names')[local.month]}, #{clock(local)}"
  end

  def clock(local)
    if I18n.locale == :fr
      local.min.zero? ? "#{local.hour} h" : format("%<h>d h %<m>02d", h: local.hour, m: local.min)
    else
      hour = local.hour % 12
      hour = 12 if hour.zero?
      suffix = local.hour < 12 ? "am" : "pm"
      local.min.zero? ? "#{hour} #{suffix}" : format("%<h>d:%<m>02d %<s>s", h: hour, m: local.min, s: suffix)
    end
  end

  def places(count) = t("event_mailer.places", count: count)
  def area_label(key) = t("events.areas.#{key}")
  def host_name(event) = event.host&.display_name.to_s
  def subject_title(event) = event.title.truncate(SUBJECT_TITLE, omission: "…")

  # « A », « B » et « C » / « A », « B », « C » et 2 autres
  def title_list(events)
    quoted = events.first(MAX_LISTED_TITLES).map { |event| t("event_mailer.quoted_title", title: subject_title(event)) }
    extra = events.size - MAX_LISTED_TITLES
    return quoted.to_sentence(two_words_connector: t("event_mailer.and"), last_word_connector: t("event_mailer.and")) unless extra.positive?

    "#{quoted.join(', ')}#{t('event_mailer.and')}#{t('event_mailer.others', count: extra)}"
  end
end
