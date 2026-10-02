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
      elsif too_many_attempts?
        redirect_to admin_login_path, alert: "Too many wrong codes. Log in again."
      else
        flash.now[:alert] = "This code doesn't work. Codes change every 30 seconds, try the new one."
        render :new, status: :unprocessable_content
      end
    end
  end
end
