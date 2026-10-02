module Admin
  # Web back office (AC-9.7): server-rendered pages, cookie session with CSRF
  # protection, password + second factor (AC-9.5), 12-hour inactivity timeout
  # (Devise timeoutable). Mobile tokens are never accepted here.
  class BaseController < ActionController::Base
    include Pundit::Authorization

    protect_from_forgery with: :exception
    layout "admin"

    before_action :refuse_bearer_tokens
    before_action :authenticate_admin!
    before_action :forbid_caching
    after_action :verify_authorized

    rescue_from Pundit::NotAuthorizedError, with: :forbidden
    rescue_from ActiveRecord::RecordNotFound, with: -> { render "admin/shared/not_found", status: :not_found }

    helper_method :current_admin

    private

    def current_admin
      return @current_admin if defined?(@current_admin)

      user = warden.user(:user)
      @current_admin = user if user&.admin? && !user.security_locked? && session[:admin_second_factor_at].present? &&
        user.admin_session_valid?(session[:admin_nonce])
    end

    def pundit_user = current_admin

    def authenticate_admin!
      return if current_admin

      warden.logout(:user) if warden.user(:user)
      redirect_to admin_login_path
    end

    # AC-9.4, AC-9.7: a mobile token never opens the back office.
    def refuse_bearer_tokens
      head :forbidden if request.authorization.present?
    end

    # Sensitive pages and images are never cached by the browser.
    def forbid_caching
      response.headers["Cache-Control"] = "no-store"
    end

    def forbidden
      render "admin/shared/forbidden", status: :forbidden
    end

    def warden = request.env["warden"]

    def audit!(action, subject: nil, fields: [], reason: nil, metadata: {})
      AuditEvent.record!(action: action, actor: current_admin, subject: subject, fields: fields, reason: reason,
                         ip_address: request.remote_ip, metadata: metadata)
    end
  end
end
