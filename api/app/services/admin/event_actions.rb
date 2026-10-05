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
    # "host_unverified" ones). Participant emails: not built yet.
    def suspend!(event)
      Event.transaction do
        event.suspend!("admin")
        resolve!(event)
        audit("suspended_event", event)
      end
    end

    def cancel!(event)
      Event.transaction do
        event.cancel!
        resolve!(event)
        audit("cancelled_event", event)
      end
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
