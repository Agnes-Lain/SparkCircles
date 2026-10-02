module Verifications
  # Admin decisions on verifications (US-9, AC-7.6, AC-7.7, AC-7.9, AC-7.11).
  # Every decision is written to the audit log. Images stay available to admins for
  # 30 days after the decision, then PurgeVerificationFilesJob erases them (AC-7.10).
  class Decision
    class Error < StandardError; end
    class OwnVerification < Error; end
    class DocumentExpired < Error; end
    class NotPending < Error; end

    def initialize(admin:, ip_address: nil)
      @admin = admin
      @ip_address = ip_address
    end

    # AC-7.6, AC-7.11: valid until the document's expiry or 2 years, whichever comes first.
    def approve!(verification, document_expires_on:)
      check_reviewable!(verification)
      raise DocumentExpired if document_expires_on.nil? || document_expires_on <= Date.current

      user = verification.user
      Verification.transaction do
        verification.update!(status: "approved", decided_at: Time.current, reviewer_id: @admin.id,
                             document_expires_on: document_expires_on)
        user.update!(verification_status: "verified",
                     verification_expires_on: Verification.validity_end(document_expires_on),
                     verification_reminder_30_sent_at: nil, verification_reminder_7_sent_at: nil)
        audit("approved_verification", user, verification)
      end
      AccountMailer.verification_approved(user).deliver_later
    end

    # AC-7.7, AC-7.4 (expired documents are rejected with the "document_expired" reason).
    def reject!(verification, reason:, note: nil)
      check_reviewable!(verification)

      user = verification.user
      Verification.transaction do
        verification.update!(status: "rejected", decided_at: Time.current, reviewer_id: @admin.id,
                             rejection_reason: reason, note: note.presence)
        user.update!(verification_status: "rejected", verification_expires_on: nil)
        audit("rejected_verification", user, verification, reason: reason)
      end
      AccountMailer.verification_rejected(user, verification).deliver_later
    end

    # AC-7.9: the parent goes back to "not verified" and is told why.
    def revoke!(user, reason:, note: nil)
      raise OwnVerification if user == @admin

      verification = user.verifications.select(&:approved?).last
      User.transaction do
        verification&.update!(revoked_at: Time.current, revoked_by_id: @admin.id, revocation_reason: reason,
                              revocation_note: note.presence)
        user.update!(verification_status: "not_verified", verification_expires_on: nil)
        audit("revoked_verification", user, verification, reason: reason)
      end
      AccountMailer.verification_revoked(user, verification).deliver_later if verification
    end

    private

    def check_reviewable!(verification)
      raise OwnVerification if verification.user_id == @admin.id # AC-9.3
      raise NotPending unless verification.pending?
    end

    def audit(action, user, verification, reason: nil)
      AuditEvent.record!(action: action, actor: @admin, subject: user, ip_address: @ip_address,
                         reason: "verification_review", metadata: { verification_id: verification&.id, decision_reason: reason }.compact)
    end
  end
end
