module Admin
  # W0 step 2: 6-digit code from the authenticator app, or a backup code (AC-9.5).
  class TwoFactorController < BaseController
    include SecondFactor

    def new
    end

    def create
      code = params[:code].to_s.gsub(/\s+/, "")
      if @pending_admin.validate_and_consume_otp!(code) || @pending_admin.invalidate_otp_backup_code!(code) && @pending_admin.save!
        complete_login!(@pending_admin)
        redirect_to admin_root_path
      elsif register_wrong_code!
        redirect_to admin_login_path, alert: LOCKED_MESSAGE
      else
        flash.now[:alert] = "This code doesn't work. Codes change every 30 seconds, try the new one."
        render :new, status: :unprocessable_content
      end
    end
  end
end
