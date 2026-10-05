# Preview every event email in development: http://localhost:3000/rails/mailers/event_mailer
# Add ?locale=en or ?locale=fr to the URL to switch language (French by default).
class EventMailerPreview < ActionMailer::Preview
  def host_activity_join = EventMailer.host_activity(event, [ entry(guest, 0, 2) ], places_left: 3, places_total: 8)
  def host_activity_change = EventMailer.host_activity(event, [ entry(guest, 2, 3) ], places_left: 2, places_total: 8)
  def host_activity_leave = EventMailer.host_activity(event, [ entry(guest, 2, 0) ], places_left: 5, places_total: 8)

  def host_activity_digest
    entries = [ entry(guest, 0, 2), entry(person("Karim", "Rahmani"), 1, 0), entry(person("Inès", "Moreau"), 2, 3) ]
    EventMailer.host_activity(event, entries, places_left: 0, places_total: 8)
  end

  def event_changed
    before = snapshot(title: "Pique-nique au parc", starts_at: event.starts_at - 1.hour, area: "paris-11")
    after = snapshot(title: event.title, starts_at: event.starts_at, area: "paris-12", places_total: 10)
    EventMailer.event_changed(event, guest, before, after)
  end

  def event_changed_address_only
    EventMailer.event_changed(event, guest, snapshot(address_digest: "old"), snapshot(address_digest: "new"))
  end

  def event_cancelled = EventMailer.event_cancelled(event, guest)
  def event_cancelled_neutral = EventMailer.event_cancelled(event, guest, neutral: true)
  def event_on_hold = EventMailer.event_on_hold(guest, [ event ])
  def event_on_hold_several = EventMailer.event_on_hold(guest, several_events)
  def events_on_hold_host = EventMailer.events_on_hold_host(host, several_events)
  def event_resumed = EventMailer.event_resumed(guest, [ event ])
  def event_resumed_several = EventMailer.event_resumed(guest, several_events.first(2))
  def events_resumed_host = EventMailer.events_resumed_host(host, [ event ])

  private

  # In-memory records: previews never touch real accounts or events, and never show an address.
  def person(first_name, last_name)
    User.new(id: SecureRandom.uuid, first_name: first_name, last_name: last_name, email: "#{first_name.downcase}@example.com",
             locale: params[:locale] || "fr", confirmed_at: Time.current)
  end

  def host = @host ||= person("Camille", "Dupont")
  def guest = @guest ||= person("Léa", "Durand")

  def event(title: "Football au parc pour les 6-10 ans", days: 4)
    Event.new(id: SecureRandom.uuid, host: host, title: title, area: "paris-12", category: "sport", time_zone: "Europe/Paris",
              starts_at: days.days.from_now.change(hour: 14, min: 30), ends_at: days.days.from_now.change(hour: 16, min: 30),
              places_total: 8)
  end

  def several_events
    @several_events ||= [ event, event(title: "Atelier peinture", days: 6), event(title: "Jeux de société", days: 8),
                          event(title: "Balade en forêt", days: 10) ]
  end

  def entry(user, from, to) = { "user" => user, "from" => from, "to" => to }

  def snapshot(**overrides)
    { "title" => event.title, "starts_at" => event.starts_at.utc.iso8601, "ends_at" => event.ends_at.utc.iso8601,
      "area" => "paris-12", "address_digest" => "same", "places_total" => 8 }.merge(overrides.transform_keys(&:to_s)
      .transform_values { |value| value.respond_to?(:utc) ? value.utc.iso8601 : value })
  end
end
