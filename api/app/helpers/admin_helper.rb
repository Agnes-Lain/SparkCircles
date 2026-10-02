module AdminHelper
  # Lucide line icons (stroke 1.8), inlined: the back office has no asset pipeline.
  ICONS = {
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    alert_circle: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    shield_x: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m14.5 9.5-5 5"/><path d="m9.5 9.5 5 5"/>'
  }.freeze

  def admin_icon(name, size: 16)
    tag.svg(ICONS.fetch(name).html_safe, xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24",
            fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round",
            "aria-hidden": "true", class: "icon")
  end

  def waiting_hours(verification_or_time)
    since = verification_or_time.respond_to?(:submitted_at) ? verification_or_time.submitted_at : verification_or_time
    ((Time.current - since) / 1.hour).floor
  end

  # Design system v1.4 badges: yellow for statuses that ask for an action, neutral only for "Not verified".
  def verification_badge(user)
    label, variant =
      if user.verified? && user.renewal_pending? then [ "Verified ✓", "green" ]
      elsif user.verified? && user.verification_expires_soon? then [ "Expires soon", "yellow" ]
      elsif user.verified? then [ "Verified ✓", "green" ]
      else
        { "pending" => [ "Pending", "yellow" ], "rejected" => [ "Not accepted", "yellow" ],
          "expired" => [ "Expired", "yellow" ] }.fetch(user.verification_status, [ "Not verified", "neutral" ])
      end
    badge = tag.span(label, class: "badge badge-#{variant}")
    user.verified? && user.renewal_pending? ? safe_join([ badge, " ", tag.span("Renewal pending", class: "badge badge-yellow") ]) : badge
  end

  def document_type_label(type) = t("verification.document_types.#{type}", locale: :en)
  def admin_date(date) = date && l(date.to_date, format: :long, locale: :en)
  def admin_datetime(time) = time && l(time, format: "%-d %b %Y, %H:%M", locale: :en)

  # "claire.m@example.com" -> "claire.m@…" (design section 8).
  def masked_email(email) = "#{email.to_s.split('@').first}@…"

  # Audit reasons as they read after "Your access is recorded: ".
  def reason_phrase(reason)
    label = AuditEvent::REASONS.fetch(reason, reason.to_s)
    label.match?(/\A[A-Z][a-z]/) ? label[0].downcase + label[1..] : label
  end

  # Text links in the back office keep a 44 px click target (design section 5).
  def target_link(text, url, **options)
    link_to text, url, **options, class: [ "link-target", options[:class] ].compact.join(" ")
  end

  def nav_link(text_or_url, url = nil, active:, &block)
    options = { class: ("active" if active), "aria-current": ("page" if active) }
    block ? link_to(text_or_url, options, &block) : link_to(text_or_url, url, options)
  end
end
