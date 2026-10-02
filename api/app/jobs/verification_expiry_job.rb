# AC-7.12, AC-7.13: daily reminders 30 and 7 days before expiry, then expiry.
# The expiry date is encrypted (spec section 7), so verified users are checked one by one.
class VerificationExpiryJob < ApplicationJob
  queue_as :default

  def perform(today: Date.current)
    User.where(verification_status: "verified").find_each do |user|
      expires_on = user.verification_expires_on
      next if expires_on.nil?

      if expires_on <= today
        # AC-7.15: a renewal still under review becomes the pending verification.
        user.update!(verification_status: user.renewal_pending? ? "pending" : "expired")
        AccountMailer.verification_expired(user).deliver_later
      else
        send_reminder(user, (expires_on - today).to_i)
      end
    end
  end

  private

  def send_reminder(user, days_left)
    column =
      if days_left <= 7
        :verification_reminder_7_sent_at
      elsif days_left <= 30
        :verification_reminder_30_sent_at
      end
    return if column.nil? || user.public_send(column)

    user.update!(column => Time.current)
    AccountMailer.verification_expiring(user, days_left).deliver_later
  end
end
