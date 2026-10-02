# Sends the account emails that carry a one-time link without ever putting the token
# in the job arguments, the queue table or the logs (AC-10.6, QA BUG-03). The job only
# receives the user and the email name, and reads or creates the token when it runs:
# - confirmation: Devise keeps the raw confirmation token on the user;
# - password reset: the database only keeps a digest, so a fresh token is created here.
class AccountTokenEmailJob < ApplicationJob
  queue_as :default

  EMAILS = %w[confirmation_instructions reset_password_instructions report_closed].freeze

  def perform(user, email)
    case email
    when "confirmation_instructions"
      return if user.confirmation_token.blank?

      to = user.pending_reconfirmation? ? user.unconfirmed_email : nil
      AccountMailer.confirmation_instructions(user, user.confirmation_token, to: to).deliver_now
    when "reset_password_instructions"
      AccountMailer.reset_password_instructions(user, new_reset_token(user)).deliver_now
    when "report_closed"
      AccountMailer.report_closed(user, new_reset_token(user)).deliver_now
    else
      raise ArgumentError, "Unknown account email: #{email}"
    end
  end

  private

  def new_reset_token(user)
    user.send(:set_reset_password_token)
  end
end
