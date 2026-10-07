module Api
  module V1
    # An invitation link or code (spec circles US-3): the preview a person sees before asking
    # (AC-3.1, AC-3.3, guests too) and the request itself (AC-2.3). Whatever the reason
    # (unknown, renewed, turned off, circle paused or nobody to approve), an invalid
    # invitation gives the same neutral answer (AC-3.5). More than 10 wrong tries in an hour,
    # per account or per device, are refused for a while (AC-2.8). The network address only
    # has a high safety ceiling, so a shared school or office network doesn't lock other
    # parents out (PM decision 2026-10-07, QA B6).
    class CircleInvitationsController < BaseController
      include GuestAccess
      include CircleAccess

      WRONG_TRIES = 10
      WRONG_TRIES_PER_IP = 100
      TRIES_WINDOW = 1.hour

      allow_guests :preview, limits: [ { to: 60, within: 1.minute, per: :device }, { to: 120, within: 1.minute, per: :ip } ]
      rate_limit to: 60, within: 1.minute, by: -> { current_user.id }, name: "circle-invitation-member", store: GuestAccess::STORE,
                 with: :rate_limited, if: :current_user

      before_action :refuse_after_wrong_tries
      before_action :find_invited_circle

      def preview
        render "api/v1/circles/preview"
      end

      def join
        ::Circles::Requests.new(@circle).ask!(current_user)
        render json: { request: { status: "pending" } }, status: :created
      end

      private

      def find_invited_circle
        token = params[:token].is_a?(String) ? params[:token] : nil
        code = params[:code].is_a?(String) ? params[:code] : nil
        @circle = Circle.find_by_invitation(token: token, code: code)
        return if @circle&.invite_enabled? && @circle.accepting_requests?

        count_wrong_try
        render_error(:gone, :invitation_invalid)
      end

      # { counter key => limit }: the account, the device (the app's device header, or the
      # device's token), and the network address with its high ceiling.
      def tries_limits
        limits = { "circle-tries:ip:#{GuestAccess.ip_hash(request.remote_ip)}" => WRONG_TRIES_PER_IP }
        limits["circle-tries:user:#{current_user.id}"] = WRONG_TRIES if current_user
        limits["circle-tries:device:#{device_key}"] = WRONG_TRIES if device_key
        limits
      end

      def device_key
        return @device_key if defined?(@device_key)

        header = request.headers[GuestAccess::DEVICE_HEADER].to_s
        @device_key = if header.match?(GuestAccess::DEVICE_FORMAT)
          header.downcase
        elsif current_jti
          "token:#{current_jti}"
        end
      end

      def refuse_after_wrong_tries
        return unless tries_limits.any? { |key, limit| GuestAccess.cache.read(key).to_i >= limit }

        render_error(:too_many_requests, :too_many_tries)
      end

      def count_wrong_try
        tries_limits.each_key { |key| GuestAccess.cache.increment(key, 1, expires_in: TRIES_WINDOW) }
      end
    end
  end
end
