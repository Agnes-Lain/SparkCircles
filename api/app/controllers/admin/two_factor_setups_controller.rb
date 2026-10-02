module Admin
  # First login of a new admin: connect an authenticator app, then show the
  # backup codes once (AC-9.5).
  class TwoFactorSetupsController < BaseController
    include SecondFactor

    before_action :redirect_if_already_set_up

    def new
      session[:admin_otp_setup_secret] ||= User.generate_otp_secret
      @secret = session[:admin_otp_setup_secret]
      @provisioning_uri = @pending_admin.otp_provisioning_uri(@pending_admin.email, issuer: OTP_ISSUER, otp_secret: @secret)
      @qr_svg = qr_svg(@provisioning_uri)
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
        @code_error = "This code doesn't work. Codes change every 30 seconds, try the new one."
        new
        render :new, status: :unprocessable_content
      end
    end

    private

    OTP_ISSUER = "SparkCircles admin".freeze
    QR_MODULE_SIZE = 6

    # Server-side SVG (no third-party service sees the secret). Dark modules on white with
    # a 4-module quiet zone; the page is never cached (BaseController#forbid_caching).
    def qr_svg(uri)
      RQRCode::QRCode.new(uri).as_svg(
        module_size: QR_MODULE_SIZE, offset: 4 * QR_MODULE_SIZE, color: "000000", fill: "ffffff",
        shape_rendering: "crispEdges", standalone: true, use_path: true, viewbox: true,
        svg_attributes: { "aria-hidden" => "true", "focusable" => "false" }
      )
    end

    def redirect_if_already_set_up
      redirect_to admin_two_factor_path if @pending_admin.otp_secret.present?
    end
  end
end
