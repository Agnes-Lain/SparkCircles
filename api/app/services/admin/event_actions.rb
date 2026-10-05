module Admin
  # Back office actions on a reported event (AC-3.11, AC-9.3). Each is audited with the
  # host as subject; open reports are marked reviewed by the action.
  class EventActions
    def initialize(admin:, ip_address: nil)
      @admin = admin
      @ip_address = ip_address
    end

    def remove_tag!(event, tag)
      Event.transaction do
        event.update_columns(tags: event.tags - [ tag ], updated_at: Time.current)
        audit("removed_event_tag", event, tag: tag)
      end
    end

    # Admin suspensions never resume on their own (Events::HostStatusSync only resumes
    # "host_unverified" ones). Participants of an upcoming published event get the neutral
    # "on hold" email (E4, never a reason); the host gets no E5 (PM decision 2026-10-06).
    def suspend!(event)
      notify = event.published? && !event.started?
      Event.transaction do
        event.suspend!("admin")
        resolve!(event)
        audit("suspended_event", event)
      end
      Events::Notifications.event_suspended_by_admin(event) if notify
    end

    def cancel!(event)
      Event.transaction do
        event.cancel!
        resolve!(event)
        audit("cancelled_event", event)
      end
      # Neutral cancellation email (E3b): no host name, no reason.
      Events::Notifications.event_cancelled(event, neutral: true)
    end

    def resolve_reports!(event)
      Event.transaction do
        count = resolve!(event)
        audit("resolved_event_reports", event, reports: count)
      end
    end

    private

    def resolve!(event)
      event.reports.open.update_all(resolved_at: Time.current, resolved_by_id: @admin.id)
    end

    def audit(action, event, **metadata)
      AuditEvent.record!(action: action, actor: @admin, subject: event.host, reason: "safety_report", ip_address: @ip_address,
                         metadata: { event_id: event.id, **metadata })
    end
  end
end
