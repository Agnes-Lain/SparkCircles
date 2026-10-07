# Finding a circle and checking what the requester may do with it (CirclePolicy, Pundit).
# A circle the requester may not see answers 404, like an unknown id (AC-4.6, AC-17.3);
# a member without the right gets 403 (circle_paused or circle_closed while the circle
# isn't active, QA B2; admin_rights_paused for an admin whose verification lapsed, AC-6.5).
module CircleAccess
  extend ActiveSupport::Concern

  included do
    include Pundit::Authorization

    rescue_from Circles::Error do |error|
      render_error(error.status, error.code)
    end
    rescue_from Pundit::NotAuthorizedError do |error|
      policy = error.policy
      if policy.is_a?(CirclePolicy) && !policy.member?
        render_error(:not_found, :not_found)
      elsif policy.is_a?(CirclePolicy) && policy.inactive?
        render_error(:forbidden, policy.circle.inactive_error_code)
      else
        render_error(:forbidden, policy.is_a?(CirclePolicy) && policy.rights_paused? ? :admin_rights_paused : :forbidden)
      end
    end
  end

  private

  def pundit_user = current_user

  def find_circle(id = params[:circle_id] || params[:id])
    @circle = Circle.find(id)
  end

  def circle_policy = @circle_policy ||= CirclePolicy.new(current_user, @circle)

  # Active members only (404 for everyone else).
  def require_member!
    raise ActiveRecord::RecordNotFound unless circle_policy.member?
  end

  def render_circle(status: :ok)
    @circle.reload
    @policy = CirclePolicy.new(current_user, @circle)
    render "api/v1/circles/show", status: status
  end
end
