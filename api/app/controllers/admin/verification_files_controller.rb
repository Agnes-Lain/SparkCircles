module Admin
  # Streams a decrypted ID image or selfie to an admin who opened the review
  # (audited in VerificationsController#show). Never cached, never a public URL (AC-10.2).
  class VerificationFilesController < BaseController
    def show
      verification = authorize Verification.find(params[:id]), :file?, policy_class: VerificationPolicy
      grant = session[:verification_view_grant] || {}
      unless grant["id"] == verification.id && grant["until"].to_i > Time.current.to_i
        return head :forbidden
      end

      data = verification.read_encrypted(params[:file])
      return head :not_found unless data

      send_data data, type: verification.file_content_type(params[:file]), disposition: "inline"
    end
  end
end
