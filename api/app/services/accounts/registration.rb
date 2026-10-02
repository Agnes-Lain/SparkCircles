module Accounts
  # US-1 sign-up. Never reveals whether an email is already registered (AC-1.3).
  class Registration
    Result = Struct.new(:success?, :user)

    def initialize(params)
      @params = params
    end

    def call
      user = build_user
      user.valid?(:registration)
      # The "already taken" error would reveal the account (AC-1.3): handled below instead.
      user.errors.delete(:email, :taken)
      return Result.new(false, user) if user.errors.any?

      existing = User.find_by(email: user.email)
      if existing
        AccountMailer.registration_attempt(existing).deliver_later
        return Result.new(true, existing)
      end

      user.save!(context: :registration)
      Result.new(true, user)
    rescue ActiveRecord::RecordNotUnique
      Result.new(true, nil)
    end

    private

    attr_reader :params

    def build_user
      user = User.new(
        first_name: params[:first_name].to_s,
        last_name: params[:last_name].to_s,
        email: params[:email].to_s,
        password: params[:password].to_s,
        adult_confirmed: params[:adult_confirmed],
        terms_accepted: params[:terms_accepted],
        locale: User::LOCALES.include?(params[:locale]) ? params[:locale] : "fr"
      )
      user.marketing_opt_in = params[:marketing_opt_in]
      user.marketing_opt_in_changed_at = nil unless user.marketing_opt_in
      now = Time.current
      user.adult_confirmed_at = now
      user.accept_current_terms(at: now)
      user
    end
  end
end
