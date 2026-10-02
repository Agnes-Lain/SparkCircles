# Sends Devise's account emails without ever putting a one-time token in the job
# arguments, the queue table or the logs (AC-10.6, QA BUG-03). The job only receives
# the user and the email name, and reads or creates the token when it runs:
# - confirmation: Devise keeps the raw confirmation token on the user;
# - password reset: the database only keeps a digest, so a fresh token is created here.
class DeviseNotificationJob < ApplicationJob
  queue_as :default

  def perform(user, notification)
    case notification
    when "confirmation_instructions"
      return if user.confirmation_token.blank?

      to = user.pending_reconfirmation? ? user.unconfirmed_email : nil
      AccountMailer.confirmation_instructions(user, user.confirmation_token, to: to).deliver_now
    when "reset_password_instructions"
      token = user.send(:set_reset_password_token)
      AccountMailer.reset_password_instructions(user, token).deliver_now
    else
      raise ArgumentError, "Unknown Devise notification: #{notification}"
    end
  end
end
