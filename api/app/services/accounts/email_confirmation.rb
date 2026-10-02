module Accounts
  # Confirms a sign-up email (AC-2.1, AC-2.2) or an email change (AC-13.3, AC-13.4,
  # AC-13.6, AC-13.7, AC-13.9). Both use Devise's confirmation token (24 hours, single use).
  class EmailConfirmation
    Result = Struct.new(:status, :user)

    def initialize(token:, current_user: nil, current_jti: nil)
      @token = token.to_s
      @current_user = current_user
      @current_jti = current_jti
    end

    def call
      user = @token.present? && User.find_by(confirmation_token: @token)
      return Result.new(:invalid) unless user

      if user.pending_reconfirmation?
        confirm_email_change(user)
      elsif user.confirmed?
        Result.new(:invalid)
      else
        user.confirm ? Result.new(:signup_confirmed, user) : Result.new(:invalid)
      end
    end

    private

    def confirm_email_change(user)
      return Result.new(:invalid) if user.confirmation_period_expired?

      previous_email = user.email
      new_email = user.unconfirmed_email
      # AC-13.6: the new address was taken by another account in the meantime.
      if User.where.not(id: user.id).exists?(email: new_email)
        return Result.new(:email_taken, user)
      end

      User.transaction do
        return Result.new(:invalid) unless user.confirm

        change = user.email_changes.create!(previous_email: previous_email, new_email: new_email, changed_at: Time.current)
        keep_jti = @current_user&.id == user.id ? @current_jti : nil
        user.revoke_all_tokens!(except_jti: keep_jti)
        AccountMailer.email_changed(user).deliver_later
        AccountMailer.email_changed_notice(change, change.generate_token_for(:report)).deliver_later
      end
      Result.new(:email_changed, user)
    rescue ActiveRecord::RecordNotUnique
      Result.new(:email_taken, user)
    end
  end
end
