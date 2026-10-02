module Accounts
  # AC-11.2: closing hides the profile, logs out every device, stops marketing
  # (User#receives_marketing?) and confirms by email. Cancelling restores the account
  # as it was, marketing choice included (AC-11.3). Personal data is erased 30 days
  # later by EraseClosedAccountsJob.
  class Closure
    def initialize(user)
      @user = user
    end

    def close!
      User.transaction do
        @user.closed_at = Time.current
        @user.save!
        @user.revoke_all_tokens!
      end
      AccountMailer.closure_confirmation(@user).deliver_later
    end
  end
end
