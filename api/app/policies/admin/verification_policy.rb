module Admin
  # US-9: admins review verifications, never their own (AC-9.3, AC-9.4).
  class VerificationPolicy
    attr_reader :admin, :verification

    def initialize(admin, verification)
      @admin = admin
      @verification = verification
    end

    def index? = admin&.admin? || false
    def show? = review?
    def file? = review?
    def approve? = review? && verification.pending?
    def reject? = approve?

    private

    def review?
      index? && verification.user_id != admin.id
    end
  end
end
