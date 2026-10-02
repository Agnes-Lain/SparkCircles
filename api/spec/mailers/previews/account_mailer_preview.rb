# Preview every account email in development: http://localhost:3000/rails/mailers
# Add ?locale=en or ?locale=fr to the URL to switch language.
class AccountMailerPreview < ActionMailer::Preview
  def confirmation_instructions = AccountMailer.confirmation_instructions(user, "preview-token")
  def email_change_confirmation = AccountMailer.confirmation_instructions(user, "preview-token", to: "new@example.com")
  def reset_password_instructions = AccountMailer.reset_password_instructions(user, "preview-token")
  def report_closed = AccountMailer.report_closed(user, "preview-token")
  def registration_attempt = AccountMailer.registration_attempt(user)
  def account_locked = AccountMailer.account_locked(user)
  def password_changed = AccountMailer.password_changed(user)
  def email_change_attempt = AccountMailer.email_change_attempt(user)
  def email_changed = AccountMailer.email_changed(user)

  def email_changed_notice
    change = EmailChange.new(id: SecureRandom.uuid, user: user, previous_email: "old@example.com", new_email: user.email,
                             changed_at: Time.current)
    AccountMailer.email_changed_notice(change)
  end

  def closure_confirmation
    AccountMailer.closure_confirmation(user(closed_at: Time.current))
  end

  def verification_approved
    AccountMailer.verification_approved(user(verification_status: "verified", verification_expires_on: 2.years.from_now.to_date))
  end

  def verification_rejected
    AccountMailer.verification_rejected(user, Verification.new(rejection_reason: "photo_blurry", note: "Use daylight"))
  end

  def verification_revoked
    AccountMailer.verification_revoked(user, Verification.new(revocation_reason: "safety_report", revocation_note: "Reported"))
  end

  def verification_expiring = AccountMailer.verification_expiring(user, 30)
  def verification_expired = AccountMailer.verification_expired(user)

  def data_export_ready
    AccountMailer.data_export_ready(user, DataExport.new(expires_at: 7.days.from_now))
  end

  private

  # In-memory user: previews never touch real accounts.
  def user(**attributes)
    User.new(first_name: "Claire", last_name: "Martin", email: "claire@example.com", locale: params[:locale] || "fr",
             **attributes)
  end
end
