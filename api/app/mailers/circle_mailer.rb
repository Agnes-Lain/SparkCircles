# Circle e-mails (spec circles AC-2.4 to AC-2.6, AC-6.4, AC-16.5; design section 5), in the
# recipient's language, through the shared message layout. Never more than the recipient
# may see in the app: a requester is "first name + initial", never an address or a reason.
class CircleMailer < ApplicationMailer
  # A circle or person deleted before the e-mail went out: drop it.
  class DeliveryJob < ActionMailer::MailDeliveryJob
    discard_on ActiveJob::DeserializationError
  end
  self.delivery_job = DeliveryJob

  # AC-2.4: one request, to one admin with rights. Requests are answered in the circle's
  # « Membres » tool (PM decision 2026-10-07), so the link opens it.
  def request_received(circle, admin, requester)
    with_recipient(admin) do
      deliver(admin, t("circle_mailer.request_received.subject", name: circle.name),
              t("circle_mailer.request_received.lines", person: requester.display_name, name: circle.name),
              action: [ "circle_mailer.request_received.action", app_link("circles/#{circle.id}/members") ])
    end
  end

  # AC-2.4: requests grouped within the hour.
  def requests_digest(circle, admin, count)
    with_recipient(admin) do
      deliver(admin, t("circle_mailer.requests_digest.subject", count: count, name: circle.name),
              t("circle_mailer.requests_digest.lines", count: count, name: circle.name),
              action: [ "circle_mailer.request_received.action", app_link("circles/#{circle.id}/members") ])
    end
  end

  # AC-2.5: "You're in".
  def request_accepted(circle, user)
    simple(user, "request_accepted", circle, "circles/#{circle.id}")
  end

  # AC-2.5: neutral, no reason, no admin name.
  def request_declined(circle, user)
    simple(user, "request_declined", circle, "circles")
  end

  # AC-2.6
  def request_expired(circle, user)
    simple(user, "request_expired", circle, "circles")
  end

  # AC-16.5: `reason` is :left or :removed; no other reason is ever given.
  def event_access_lost(event, user, reason)
    with_recipient(user) do
      deliver(user, t("circle_mailer.event_access_lost.subject", title: event.title.truncate(40, omission: "…")),
              [ t("circle_mailer.event_access_lost.#{reason}", title: event.title) ],
              action: [ "circle_mailer.event_access_lost.action", app_link("events") ])
    end
  end

  # AC-6.4 (`closed_account`), AC-6.5 (`no_verified_admin`): no name, no reason beyond that.
  def new_admin(circle, user, reason = "closed_account")
    with_recipient(user) do
      deliver(user, t("circle_mailer.new_admin.subject", name: circle.name),
              t("circle_mailer.new_admin.lines.#{reason}", name: circle.name),
              action: [ "circle_mailer.new_admin.action", app_link("circles/#{circle.id}") ])
    end
  end

  # AC-6.4: 30 days' notice.
  def circle_closing(circle, user)
    with_recipient(user) do
      deliver(user, t("circle_mailer.circle_closing.subject", name: circle.name),
              t("circle_mailer.circle_closing.lines", name: circle.name, date: I18n.l(circle.closes_on, format: :long)),
              action: [ "circle_mailer.circle_closing.action", app_link("circles") ])
    end
  end

  private

  def simple(user, key, circle, path)
    with_recipient(user) do
      deliver(user, t("circle_mailer.#{key}.subject", name: circle.name), t("circle_mailer.#{key}.lines", name: circle.name),
              action: [ "circle_mailer.#{key}.action", app_link(path) ])
    end
  end

  def with_recipient(user, &)
    I18n.with_locale(user.locale, &)
  end

  def deliver(user, subject, lines, action:)
    @greeting = t("account_mailer.greeting", first_name: user.first_name)
    @title_block = nil
    @lines = Array(lines)
    @action_label = t(action.first)
    @action_url = action.last
    mail(to: user.email, subject: subject, template_path: "event_mailer", template_name: "message")
  end
end
