module Admin
  # W4/W5: member search and actions (AC-7.9, AC-9.6, AC-13.8).
  class MemberPolicy
    attr_reader :admin, :member

    def initialize(admin, member)
      @admin = admin
      @member = member
    end

    def index? = admin&.admin? || false
    def search? = index?
    def show? = index?
    def restore_email? = index? && member != admin # same rule as AC-9.3
    def close_report? = restore_email? # AC-13.10
    def revoke_verification? = index? && member != admin
    def grant_admin? = index? && member != admin && !member.admin?
    def remove_admin? = index? && member != admin && member.admin?
  end
end
