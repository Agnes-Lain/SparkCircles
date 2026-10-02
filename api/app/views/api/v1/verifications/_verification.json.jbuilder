# Verification state as the owner sees it (AC-7.x). Others only ever get `verified` (AC-8.2).
latest = user.latest_verification
json.status user.verification_status
json.verified user.verified?
json.expires_on user.verification_status == "verified" ? user.verification_expires_on&.iso8601 : nil
json.expires_soon user.verification_expires_soon?
json.revoked(user.verification_status == "not_verified" && latest&.revoked? || false)
json.submitted_at latest&.submitted_at&.utc&.iso8601
rejection =
  if latest&.revoked? && user.verification_status == "not_verified"
    { reason: latest.revocation_reason, message: t("verification.revocation_messages.#{latest.revocation_reason}"),
      note: latest.revocation_note }
  elsif user.verification_status == "rejected" && latest&.rejected?
    { reason: latest.rejection_reason, message: t("verification.rejection_messages.#{latest.rejection_reason}"), note: latest.note }
  end
json.rejection rejection
# AC-7.15: a renewal sent while verified ("renewal pending", or rejected while the old one is still valid).
renewal = latest if latest&.renewal? && !latest.approved? && user.verified?
json.renewal(renewal && {
  status: renewal.status,
  submitted_at: renewal.submitted_at.utc.iso8601,
  rejection: renewal.rejected? ? { reason: renewal.rejection_reason,
                                   message: t("verification.rejection_messages.#{renewal.rejection_reason}"),
                                   note: renewal.note } : nil
})
