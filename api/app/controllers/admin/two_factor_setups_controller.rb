module Admin
  # First login of a new admin: connect an authenticator app, then show the
  # backup codes once (AC-9.5).
  class TwoFactorSetupsController < BaseController
    include SecondFactor

    before_action :redirect_if_already_set_up

    def new
      session[:admin_otp_setup_secret] ||= User.generate_otp_secret
      @secret = session[:admin_otp_setup_secret]
      @provisioning_uri = @pending_admin.otp_provisioning_uri(@pending_admin.email, issuer: "SPARKCIRCLES admin", otp_secret: @secret)
    end

    def create
      secret = session[:admin_otp_setup_secret]
      if secret && @pending_admin.validate_and_consume_otp!(params[:code].to_s, otp_secret: secret)
        @pending_admin.otp_secret = secret
        @pending_admin.otp_required_for_login = true
        @backup_codes = @pending_admin.generate_otp_backup_codes!
        @pending_admin.save!
        complete_login!(@pending_admin)
        render :backup_codes
      elsif register_wrong_code!
        redirect_to admin_login_path, alert: LOCKED_MESSAGE
      else
        flash.now[:alert] = "This code doesn't work. Codes change every 30 seconds, try the new one."
        new
        render :new, status: :unprocessable_content
      end
    end

    private

    def redirect_if_already_set_up
      redirect_to admin_two_factor_path if @pending_admin.otp_secret.present?
    end
  end
end
