module Admin
  # W4 find a member, W5 member detail (AC-7.9, AC-9.6, AC-10.4, AC-13.8).
  # Every access to a member's personal data needs a reason, recorded in the audit log.
  class MembersController < BaseController
    ACCESS_REASONS = %w[user_request safety_report verification_follow_up email_change_report].freeze

    def index
      authorize User, policy_class: MemberPolicy
      @open_reports = EmailChange.open_reports.includes(:user).order(:reported_at)
    end

    # POST so the email never appears in a URL (AC-10.6).
    def search
      authorize User, policy_class: MemberPolicy
      reason = params[:reason].to_s
      unless ACCESS_REASONS.include?(reason)
        @open_reports = EmailChange.open_reports.includes(:user).order(:reported_at)
        @search_error = "Choose why you're looking for this member."
        return render :index, status: :unprocessable_content
      end

      member = User.find_by(email: params[:email].to_s.strip.downcase)
      audit!("searched_member", subject: member, reason: reason, metadata: { found: member.present? })
      if member
        redirect_to admin_member_path(member, reason: reason)
      else
        @open_reports = EmailChange.open_reports.includes(:user).order(:reported_at)
        @search_error = "No member uses this email."
        render :index, status: :unprocessable_content
      end
    end

    def show
      @member = authorize User.find(params[:id]), policy_class: MemberPolicy
      @reason = params[:reason].to_s
      return render :reason unless ACCESS_REASONS.include?(@reason)

      audit!("viewed_member", subject: @member, reason: @reason, fields: %w[full_name email roles verification])
      @reports = @member.email_changes.open_reports
    end

    def revoke_verification
      member = authorize User.find(params[:id]), policy_class: MemberPolicy
      reason = params[:revocation_reason].to_s
      unless Verification::REVOCATION_REASONS.include?(reason)
        return redirect_to admin_member_path(member, reason: "safety_report"), alert: "Choose a reason."
      end

      Verifications::Decision.new(admin: current_admin, ip_address: request.remote_ip)
        .revoke!(member, reason: reason, note: params[:note])
      redirect_to admin_member_path(member, reason: "safety_report"), notice: "Verification removed."
    end

    def grant_admin
      member = authorize User.find(params[:id]), policy_class: MemberPolicy
      member_actions.grant_admin!(member)
      redirect_to admin_member_path(member, reason: "user_request"), notice: "Admin role given."
    end

    def remove_admin
      member = authorize User.find(params[:id]), policy_class: MemberPolicy
      member_actions.remove_admin!(member)
      redirect_to admin_member_path(member, reason: "user_request"), notice: "Admin role removed."
    end

    def restore_email
      member = authorize User.find(params[:id]), policy_class: MemberPolicy
      email_change = member.email_changes.open_reports.find(params[:email_change_id])
      member_actions.restore_email!(email_change)
      redirect_to admin_member_path(member, reason: "email_change_report"),
                  notice: "Email restored. A password reset link was sent to it."
    rescue Admin::MemberActions::Error
      redirect_to admin_member_path(member, reason: "email_change_report"), alert: "This email can't be restored: another account uses it."
    end

    private

    def member_actions = Admin::MemberActions.new(admin: current_admin, ip_address: request.remote_ip)
  end
end
