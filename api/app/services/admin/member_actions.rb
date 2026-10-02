module Admin
  # Role changes and "This wasn't me" follow-up in the back office (AC-1.7, AC-9.6, AC-13.8).
  class MemberActions
    class Error < StandardError; end

    def initialize(admin:, ip_address: nil)
      @admin = admin
      @ip_address = ip_address
    end

    # AC-1.7, AC-9.6: same account, new role; only an existing admin can do it; audited.
    def grant_admin!(user)
      raise Error, "own account" if user == @admin

      User.transaction do
        user.roles.find_or_create_by!(name: "admin") { |role| role.granted_by_id = @admin.id }
        AuditEvent.record!(action: "granted_admin_role", actor: @admin, subject: user, ip_address: @ip_address)
      end
    end

    # AC-1.7: removing a role never deletes the account.
    def remove_admin!(user)
      raise Error, "own account" if user == @admin

      User.transaction do
        user.roles.where(name: "admin").delete_all
        user.update!(otp_secret: nil, otp_required_for_login: false, otp_backup_codes: nil)
        AuditEvent.record!(action: "removed_admin_role", actor: @admin, subject: user, ip_address: @ip_address)
      end
    end

    # AC-13.8: after checking a report, restore the previous email; the owner then
    # sets a new password through a reset link sent to that address.
    def restore_email!(email_change)
      user = email_change.user
      raise Error, "not reported" unless email_change.reported? && email_change.restored_at.nil?
      raise Error, "email taken" if User.where.not(id: user.id).exists?(email: email_change.previous_email)

      User.transaction do
        user.skip_reconfirmation!
        user.update!(email: email_change.previous_email, unconfirmed_email: nil, security_locked_at: nil,
                     locked_at: nil, failed_attempts: 0)
        email_change.update!(restored_at: Time.current, restored_by_id: @admin.id)
        AuditEvent.record!(action: "restored_email", actor: @admin, subject: user, ip_address: @ip_address,
                           reason: "email_change_report", metadata: { email_change_id: email_change.id })
      end
      user.send_reset_password_instructions
    end
  end
end
