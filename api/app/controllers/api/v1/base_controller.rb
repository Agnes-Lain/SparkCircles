module Api
  module V1
    # Base of the JSON API used by the mobile app. Authentication: one bearer JWT
    # per device (devise-jwt Allowlist). Admin functions are never reachable here (AC-9.7).
    class BaseController < ActionController::API
      include ActionController::HttpAuthentication::Token::ControllerMethods

      GATES = %i[email_not_confirmed closure_pending terms_acceptance_required].freeze

      class_attribute :gate_exemptions, default: {}

      # Lets an action run despite an account gate (see docs/api, "Account gates").
      def self.exempt_from_gates(*gates, only:)
        exemptions = gate_exemptions.dup
        gates.each { |gate| exemptions[gate] = (exemptions.fetch(gate, []) + Array(only).map(&:to_s)).uniq }
        self.gate_exemptions = exemptions
      end

      before_action :set_locale
      before_action :authenticate_user!
      before_action :enforce_account_gates!

      rescue_from ActiveRecord::RecordNotFound, with: -> { render_error(:not_found, :not_found) }
      rescue_from ActionController::ParameterMissing, with: -> { render_error(:bad_request, :bad_request) }

      private

      attr_reader :current_user, :current_jti

      def authenticate_user!
        authenticate_from_token || render_error(:unauthorized, :unauthorized)
      end

      def authenticate_from_token
        token = bearer_token
        return false if token.blank?

        payload = Warden::JWTAuth::TokenDecoder.new.call(token)
        @current_user = Warden::JWTAuth::UserDecoder.new.call(token, :user, nil)
        @current_jti = payload["jti"]
        true
      rescue JWT::DecodeError, Warden::JWTAuth::Errors::RevokedToken, Warden::JWTAuth::Errors::NilUser,
             Warden::JWTAuth::Errors::WrongScope, Warden::JWTAuth::Errors::WrongAud, ActiveRecord::RecordNotFound
        @current_user = nil
        false
      end

      def bearer_token
        request.authorization.to_s[/\ABearer (.+)\z/, 1]
      end

      def enforce_account_gates!
        gate = GATES.find { |name| gate_applies?(name) && !gate_exemptions.fetch(name, []).include?(action_name) }
        render_error(:forbidden, gate) if gate
      end

      def gate_applies?(gate)
        case gate
        when :email_not_confirmed then !current_user.confirmed?
        when :closure_pending then current_user.closed?
        when :terms_acceptance_required then current_user.terms_acceptance_required?
        end
      end

      # The one check every restricted action uses (AC-7.14, AC-8.4, AC-8.5).
      def require_verified!
        render_error(:forbidden, :verification_required) unless current_user.verified?
      end

      def set_locale
        requested = request.headers["Accept-Language"].to_s[0, 2]
        I18n.locale = User::LOCALES.include?(requested) ? requested : I18n.default_locale
      end

      def render_error(status, code, details: nil)
        error = { code: code.to_s, message: I18n.t("api.errors.#{code}") }
        error[:details] = details if details
        render json: { error: error }, status: status
      end

      def render_validation_errors(record_or_errors)
        errors = record_or_errors.is_a?(ActiveModel::Errors) ? record_or_errors : record_or_errors.errors
        details = errors.details.transform_values { |list| list.map { |detail| detail[:error].to_s }.uniq }
        render_error(:unprocessable_content, :validation_failed, details: details)
      end

      # The owner's own account (docs/api section 2). With `token:`, wraps it as
      # { token, user } for the endpoints that log a device in.
      def render_me(user = current_user, status: :ok, token: :omit)
        @user = user
        if token == :omit
          render "api/v1/me/show", status: status
        else
          @token = token
          render "api/v1/me/with_token", status: status
        end
      end

      def rate_limited
        render_error(:too_many_requests, :rate_limited)
      end
    end
  end
end
