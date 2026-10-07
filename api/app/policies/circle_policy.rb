# What a person may do in a circle (spec circles US-4 to US-7, US-17). The API decides
# everything here; the app only mirrors `can` from the member view.
#
# - member: an active membership of an account that isn't closed.
# - manage: an admin with rights, i.e. verified right now (AC-6.1, AC-6.5).
class CirclePolicy
  attr_reader :user, :circle

  def initialize(user, circle)
    @user = user
    @circle = circle
  end

  def membership
    return @membership if defined?(@membership)

    @membership = user && !user.closed? ? circle.membership_for(user) : nil
  end

  def member? = membership&.active? || false
  # AC-4.6, AC-17.5: non-members see a discoverable circle's public page, nothing else.
  def show_public? = circle.discoverable?
  def admin? = member? && membership.admin?
  def manage? = admin? && user.verified?
  def rights_paused? = admin? && !user.verified?
  alias_method :update?, :manage?
  alias_method :invite?, :manage?
  alias_method :decide_requests?, :manage?
  alias_method :remove_member?, :manage?
  alias_method :promote?, :manage?

  # AC-6.7: only when no other verified member could run the circle.
  def destroy?
    manage? && circle.active_memberships.where.not(id: membership.id).includes(:user).none? { |other| other.user.verified? }
  end

  def step_down? = admin? && circle.admins.where.not(id: membership.id).exists?
  def leave? = member?
  # AC-5.5: circle admins see the audit entries (even with paused rights).
  def activity? = admin?
  # AC-7.1, AC-17.7: members, and anyone who can see a public circle's page.
  def report? = member? || (user.present? && show_public?)
end
