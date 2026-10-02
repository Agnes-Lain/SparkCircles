module Admin
  # W1 queue, W2 review, W3 rejection (US-9).
  class VerificationsController < BaseController
    include Pagy::Method

    VIEW_GRANT_LIFETIME = 15.minutes

    def index
      authorize Verification, policy_class: VerificationPolicy
      @pagy, @verifications = pagy(:offset, Verification.queue.includes(:user), limit: 25)
      @waiting_count = Verification.pending.count
    end

    # AC-9.2, AC-10.4: opening a review is an audited access to ID images and personal data.
    def show
      @verification = authorize Verification.find(params[:id]), policy_class: VerificationPolicy
      audit!("viewed_verification", subject: @verification.user, reason: "verification_review",
             fields: %w[document_images selfie date_of_birth full_name], metadata: { verification_id: @verification.id })
      session[:verification_view_grant] = { "id" => @verification.id, "until" => VIEW_GRANT_LIFETIME.from_now.to_i }
    end

    def approve
      @verification = authorize Verification.find(params[:id]), policy_class: VerificationPolicy
      expires_on = parse_date(params[:document_expires_on])
      decision.approve!(@verification, document_expires_on: expires_on)
      redirect_to admin_verifications_path, notice: "Approved. #{@verification.user.display_name} is verified."
    rescue Verifications::Decision::DocumentExpired
      @expiry_error = expires_on ? "This document has expired. Choose 'Not accepted' with the reason 'Document expired'." : "Add the document's expiry date."
      render :show, status: :unprocessable_content
    end

    def reject
      @verification = authorize Verification.find(params[:id]), policy_class: VerificationPolicy
      reason = params[:rejection_reason].to_s
      unless Verification::REJECTION_REASONS.include?(reason)
        @reject_error = "Choose a reason."
        return render :show, status: :unprocessable_content
      end

      decision.reject!(@verification, reason: reason, note: params[:note])
      redirect_to admin_verifications_path, notice: "Sent to #{@verification.user.display_name}."
    end

    private

    def decision = Verifications::Decision.new(admin: current_admin, ip_address: request.remote_ip)

    def parse_date(value)
      Date.iso8601(value.to_s)
    rescue Date::Error
      nil
    end
  end
end
