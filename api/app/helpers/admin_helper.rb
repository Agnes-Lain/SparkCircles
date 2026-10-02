module AdminHelper
  # Lucide line icons (stroke 1.8), inlined: the back office has no asset pipeline.
  ICONS = {
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    alert_circle: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    shield_check: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    log_out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>'
  }.freeze

  def admin_icon(name, size: 16)
    tag.svg(ICONS.fetch(name).html_safe, xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24",
            fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round",
            "aria-hidden": "true", class: "icon")
  end

  def waiting_hours(verification)
    (verification.waiting_time / 1.hour).floor
  end

  def verification_badge(user)
    if user.verified?
      tag.span("Verified ✓", class: "badge badge-green")
    elsif user.verification_status == "pending"
      tag.span("Pending", class: "badge badge-yellow")
    else
      tag.span(user.verification_status.humanize, class: "badge badge-neutral")
    end
  end

  def document_type_label(type) = t("verification.document_types.#{type}", locale: :en)
  def admin_date(date) = date && l(date.to_date, format: :long, locale: :en)
end
