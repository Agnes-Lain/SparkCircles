module Accounts
  # AC-13.8: secure the account at once after a "This wasn't me" report.
  class EmailChangeReport
    def initialize(email_change, ip_address: nil)
      @email_change = email_change
      @ip_address = ip_address
    end

    def call
      user = @email_change.user
      User.transaction do
        @email_change.update!(reported_at: Time.current)
        user.revoke_all_tokens!
        user.update!(security_locked_at: Time.current)
        AuditEvent.record!(action: "email_change_reported", subject: user, reason: "email_change_report",
                           ip_address: @ip_address, metadata: { email_change_id: @email_change.id })
      end
    end
  end
end
