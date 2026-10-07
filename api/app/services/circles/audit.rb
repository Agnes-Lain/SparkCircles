module Circles
  # AC-5.5: joins, removals and admin changes are kept in the append-only audit log, with the
  # circle in the metadata. Circle admins (GET /circles/:id/activity) and SparkCircles admins
  # see them; after erasure an entry keeps only the person's internal id (pseudonymous).
  module Audit
    # What circle admins see (back-office moderation and reports stay with SparkCircles, AC-7.2).
    CIRCLE_ACTIONS = %w[circle_created circle_member_joined circle_request_declined circle_member_left circle_member_removed
                        circle_admin_promoted circle_admin_stepped_down circle_visibility_changed circle_invitation_renewed
                        circle_invitation_toggled circle_admin_succession].freeze

    module_function

    def record!(action, circle, actor: nil, subject: nil, reason: nil, ip_address: nil, fields: [], **metadata)
      AuditEvent.record!(action: action, actor: actor, subject: subject, reason: reason, ip_address: ip_address, fields: fields,
                         metadata: { circle_id: circle.id, **metadata })
    end

    def entries(circle, limit: 100)
      AuditEvent.where("metadata ->> 'circle_id' = ?", circle.id).where(action: CIRCLE_ACTIONS)
                .order(created_at: :desc).limit(limit)
    end
  end
end
