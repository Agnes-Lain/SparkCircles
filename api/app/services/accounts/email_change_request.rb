module Accounts
  # US-13: a logged-in user asks to change their email (AC-13.1, AC-13.2, AC-13.4, AC-13.5).
  # The answer never reveals whether the new address belongs to another account.
  class EmailChangeRequest
    Result = Struct.new(:status, :errors)

    def initialize(user:, email:, current_password:)
      @user = user
      @email = email.to_s.strip.downcase
      @current_password = current_password.to_s
    end

    def call
      return Result.new(:invalid_password) unless @user.valid_password?(@current_password)

      errors = ActiveModel::Errors.new(@user)
      errors.add(:email, :invalid) unless @email.match?(URI::MailTo::EMAIL_REGEXP)
      errors.add(:email, :same_as_current) if @email == @user.email
      return Result.new(:invalid, errors) if errors.any?

      owner = User.find_by(email: @email)
      if owner
        # AC-13.5: no change can happen; tell the owner of that address.
        AccountMailer.email_change_attempt(owner).deliver_later
      else
        # Devise reconfirmable: stores the address as unconfirmed_email, keeps the
        # current email for login and replaces any previous link (AC-13.2, AC-13.4).
        @user.email = @email
        @user.save!
      end
      Result.new(:requested)
    end
  end
end
