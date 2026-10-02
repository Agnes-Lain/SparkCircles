module Admin
  # Role changes and "This wasn't me" follow-up in the back office
  # (AC-1.7, AC-9.6, AC-13.8, AC-13.10).
  class MemberActions
    class Error < StandardError; end
    class OwnAccount < Error; end
    class EmailTaken < Error; end
    class NoteRequired < Error; end

    def initialize(admin:, ip_address: nil)
      @admin = admin
      @ip_address = ip_address
    end

    # AC-1.7, AC-9.6: same account, new role; only an existing admin can do it; audited.
    def grant_admin!(user)
      raise OwnAccount if user == @admin

      User.transaction do
        user.roles.find_or_create_by!(name: "admin") { |role| role.granted_by_id = @admin.id }
        AuditEvent.record!(action: "granted_admin_role", actor: @admin, subject: user, ip_address: @ip_address)
      end
    end

    # AC-1.7: removing a role never deletes the account.
    def remove_admin!(user)
      raise OwnAccount if user == @admin

      User.transaction do
        user.roles.where(name: "admin").delete_all
        user.update!(otp_secret: nil, otp_required_for_login: false, otp_backup_codes: nil, admin_session_digest: nil,
                     admin_pending_digest: nil)
        AuditEvent.record!(action: "removed_admin_role", actor: @admin, subject: user, ip_address: @ip_address)
      end
    end

    # AC-13.8: restore the previous email. The password the attacker knew stops working
    # (QA BUG-02), every session ends, and the owner sets a new password through a reset
    # link sent to the restored address.
    def restore_email!(email_change)
      user = check_open_report!(email_change)
      raise EmailTaken if User.where.not(id: user.id).exists?(email: email_change.previous_email)

      User.transaction do
        user.skip_reconfirmation!
        secure_and_unlock!(user, email: email_change.previous_email, unconfirmed_email: nil)
        email_change.update!(restored_at: Time.current, restored_by_id: @admin.id)
        AuditEvent.record!(action: "restored_email", actor: @admin, subject: user, ip_address: @ip_address,
                           reason: "email_change_report", metadata: { email_change_id: email_change.id })
      end
      AccountTokenEmailJob.perform_later(user, "reset_password_instructions")
    end

    # AC-13.10: the member did make the change. The email stays, the account unlocks, the
    # current password stops working and a reset link goes to the current address.
    def close_report!(email_change, note:)
      user = check_open_report!(email_change)
      raise NoteRequired if note.to_s.strip.blank?

      User.transaction do
        secure_and_unlock!(user)
        email_change.update!(closed_at: Time.current, closed_by_id: @admin.id)
        AuditEvent.record!(action: "closed_email_change_report", actor: @admin, subject: user, ip_address: @ip_address,
                           reason: "email_change_report", note: note.to_s.strip.first(1000),
                           metadata: { email_change_id: email_change.id })
      end
      AccountTokenEmailJob.perform_later(user, "report_closed")
    end

    private

    def check_open_report!(email_change)
      user = email_change.user
      raise OwnAccount if user == @admin # same rule as AC-9.3
      raise Error, "report not open" unless email_change.open_report?

      user
    end

    # Unlocks the account but keeps it unusable until the owner sets a new password:
    # a random password nobody knows, no device token, no back office session.
    def secure_and_unlock!(user, **attributes)
      user.update!(password: SecureRandom.base58(48), security_locked_at: nil, locked_at: nil, failed_attempts: 0,
                   admin_session_digest: nil, admin_pending_digest: nil, **attributes)
      user.revoke_all_tokens!
    end
  end
end
