# Every account email, in the recipient's language (French or English).
# The first methods are the ones Devise calls (config.mailer = "AccountMailer").
# Emails never contain sensitive data beyond the recipient's first name (AC-10.6).
class AccountMailer < ApplicationMailer
  # Sign-up confirmation and email-change confirmation (AC-2.1, AC-13.2).
  def confirmation_instructions(user, token, opts = {})
    key = opts[:to].present? ? :email_change_confirmation : :confirmation_instructions
    compose(user, key, to: opts[:to].presence || user.email, action: app_link("confirm-email", token))
  end

  # AC-4.1
  def reset_password_instructions(user, token, _opts = {})
    compose(user, :reset_password_instructions, action: app_link("reset-password", token))
  end

  # AC-1.3
  def registration_attempt(user)
    compose(user, :registration_attempt, action: app_link("forgot-password"))
  end

  # AC-3.3
  def account_locked(user)
    compose(user, :account_locked, action: app_link("forgot-password"))
  end

  # AC-4.2
  def password_changed(user)
    compose(user, :password_changed, action: app_link("forgot-password"))
  end

  # AC-13.5
  def email_change_attempt(user)
    compose(user, :email_change_attempt)
  end

  # AC-13.3: sent to the new address once the change took effect.
  def email_changed(user)
    compose(user, :email_changed)
  end

  # AC-13.7: sent to the old address, with the "This wasn't me" link.
  def email_changed_notice(email_change, token)
    user = email_change.user
    compose(user, :email_changed_notice, to: email_change.previous_email,
            action: app_link("this-wasnt-me", token),
            values: { date: I18n.l(email_change.changed_at.to_date, format: :long, locale: user.locale) })
  end

  # AC-11.2
  def closure_confirmation(user)
    compose(user, :closure_confirmation, values: { date: I18n.l(user.erasure_on, format: :long, locale: user.locale) })
  end

  # AC-7.6
  def verification_approved(user)
    compose(user, :verification_approved,
            values: { date: I18n.l(user.verification_expires_on, format: :long, locale: user.locale) })
  end

  # AC-7.7
  def verification_rejected(user, verification)
    compose(user, :verification_rejected, values: { reason: rejection_message(user, verification.rejection_reason) },
            note: verification.note)
  end

  # AC-7.9
  def verification_revoked(user, verification)
    compose(user, :verification_revoked, note: verification.revocation_note)
  end

  # AC-7.12
  def verification_expiring(user, days)
    compose(user, :verification_expiring, values: { days: days })
  end

  # AC-7.13
  def verification_expired(user)
    compose(user, :verification_expired)
  end

  # AC-12.1
  def data_export_ready(user, data_export)
    compose(user, :data_export_ready, action: app_link("my-data"),
            values: { date: I18n.l(data_export.expires_at.to_date, format: :long, locale: user.locale) })
  end

  private

  def compose(user, key, to: user.email, action: nil, values: {}, note: nil)
    I18n.with_locale(user.locale) do
      scope = [ :account_mailer, key ]
      @greeting = I18n.t("account_mailer.greeting", first_name: user.first_name)
      @lines = I18n.t(:lines, scope: scope, **values)
      @note = note.presence
      @action_label = I18n.t(:action, scope: scope, default: nil) if action
      @action_url = action
      mail(to: to, subject: I18n.t(:subject, scope: scope, **values), template_name: "message")
    end
  end

  def rejection_message(user, reason)
    I18n.t("verification.rejection_messages.#{reason}", locale: user.locale)
  end
end
