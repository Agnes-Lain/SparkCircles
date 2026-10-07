module Dev
  # Development only: email links point here (http://<Mac LAN IP>:3000/dev/open-app/<path>?token=…)
  # and this page sends the phone on to Expo Go (exp://<Mac LAN IP>:8081/--/<path>?token=…).
  # iOS ignores taps on exp:// links inside letter_opener_web's iframes, but follows normal
  # http links from any viewer. The route is only drawn in development (config/routes.rb).
  class OpenAppController < ActionController::Base
    # The routes the app opens from an email link (mobile/src/auth/gate.ts, LINK_ROUTES).
    # The email-change confirmation uses confirm-email too. Event emails open events/<id>,
    # events, my-events and verification. Circle emails open circles and circles/<id>; an
    # invitation link is join/<token>.
    PATHS = %w[confirm-email reset-password this-wasnt-me forgot-password my-data events my-events verification circles].freeze
    # Paths with an id: only a UUID (or an invitation token) is accepted after the prefix.
    PATH_PATTERNS = [
      %r{\Aevents/\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z},
      %r{\Acircles/\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z},
      %r{\Ajoin/[A-Za-z0-9_-]{16,64}\z}
    ].freeze

    def self.allowed?(path) = PATHS.include?(path) || PATH_PATTERNS.any? { |pattern| pattern.match?(path.to_s) }

    before_action { head :not_found unless Rails.env.development? && self.class.allowed?(params[:path]) }

    def show
      # The query holds a one-time token: keep it out of caches and Referer headers.
      response.headers["Cache-Control"] = "no-store"
      response.headers["Referrer-Policy"] = "no-referrer"
      response.headers["X-Robots-Tag"] = "noindex"

      target = "#{Rails.configuration.x.expo_go_link_base}/#{params[:path]}"
      target += "?#{request.query_string}" if request.query_string.present?

      render html: page(target), layout: false
    end

    private

    def page(target)
      href = ERB::Util.html_escape(target)
      js = ERB::Util.json_escape(target.to_json)
      <<~HTML.html_safe
        <!doctype html>
        <html lang="fr">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta name="robots" content="noindex">
          <meta name="referrer" content="no-referrer">
          <title>SparkCircles (dev)</title>
        </head>
        <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 48px 16px;">
          <p><a href="#{href}" target="_top" style="font-size: 20px;">Ouvrir dans Expo Go / Open in Expo Go</a></p>
          <script>try { window.top.location.href = #{js}; } catch (e) { window.location.href = #{js}; }</script>
        </body>
        </html>
      HTML
    end
  end
end
