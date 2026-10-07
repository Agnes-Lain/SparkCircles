module Admin
  # Reported circles (spec circles US-7, AC-7.2, AC-7.3, AC-17.7): queue, audited detail,
  # suspend or resume, force private, mark reports reviewed. Revoking a member's
  # verification happens on their member page (accounts AC-7.9).
  class CirclesController < BaseController
    def index
      authorize Circle, policy_class: CirclePolicy
      @circles = Circle.where(id: CircleReport.open.select(:circle_id)).includes(reports: :reported_user).to_a
      @circles.sort_by! { |circle| circle.reports.select { |report| report.resolved_at.nil? }.map(&:created_at).min }
    end

    def show
      @circle = authorize Circle.includes(reports: %i[reporter reported_user]).find(params[:id]), policy_class: CirclePolicy
      @open_reports = @circle.reports.select { |report| report.resolved_at.nil? }.sort_by(&:created_at)
      @admins = @circle.admins.includes(:user).to_a
      audit("viewed_circle", fields: %w[circle reports])
    end

    # AC-7.3: members see "This circle is paused", nothing else; its events vanish for members.
    def suspend
      act(:suspend?, "circle_suspended", notice: "Circle paused.") do
        @circle.update!(status: "suspended", suspended_at: Time.current)
      end
    end

    def resume
      act(:resume?, "circle_resumed", notice: "Circle resumed.") do
        @circle.update!(status: "active", suspended_at: nil)
        # Members who hid the "paused" card get the circle back in their list.
        @circle.memberships.active.update_all(dismissed_at: nil)
      end
    end

    # AC-17.7: out of search at once; members, requests and links stay. It stays private
    # until staff lift it (QA B3, PM decision 2026-10-07).
    def force_private
      act(:force_private?, "circle_forced_private", notice: "Circle made private.") do
        now = Time.current
        @circle.update_columns(visibility: "private", premium_entitlement: Circle::PRIVATE_ENTITLEMENT, forced_private_at: now,
                               visibility_changed_at: now, updated_at: now)
      end
    end

    # The circle's admins may make it public again; it stays private until they do.
    def lift_private
      act(:lift_private?, "circle_forced_private_lifted", notice: "Circle admins can make it public again.") do
        @circle.update_columns(forced_private_at: nil, updated_at: Time.current)
      end
    end

    def resolve_reports
      act(:resolve_reports?, nil, notice: "Reports marked as reviewed.", redirect: admin_circles_path) { }
    end

    private

    def act(query, action, notice:, redirect: nil)
      @circle = authorize Circle.find(params[:id]), query, policy_class: CirclePolicy
      Circle.transaction do
        yield
        @circle.reports.open.update_all(resolved_at: Time.current, resolved_by_id: current_admin.id)
        audit(action || "resolved_circle_reports")
      end
      redirect_to redirect || admin_circle_path(@circle), notice: notice
    end

    def audit(action, fields: [])
      Circles::Audit.record!(action, @circle, actor: current_admin, reason: "safety_report", ip_address: request.remote_ip,
                                              fields: fields)
    end
  end
end
