require "rails_helper"

# Development email links go through /dev/open-app/<path>, which redirects to Expo Go.
# The query holds one-time tokens, so the page must never exist outside development.
RSpec.describe "Development app link redirect (/dev/open-app)", type: :request do
  it "is not reachable in the test environment" do
    get "/dev/open-app/confirm-email?token=abc"

    expect(response).to have_http_status(:not_found)
  end

  it "is not drawn outside development" do
    expect { Rails.application.routes.recognize_path("/dev/open-app/confirm-email") }
      .to raise_error(ActionController::RoutingError)
    expect(File.read(Rails.root.join("config/routes.rb")))
      .to match(%r{get "dev/open-app/\*path".* if Rails\.env\.development\?$})
  end

  context "when the route is drawn (as in development)" do
    around do |example|
      previous = Rails.configuration.x.expo_go_link_base
      Rails.configuration.x.expo_go_link_base = "exp://192.168.1.77:8081/--"
      with_routing do |set|
        set.draw { get "dev/open-app/*path", to: "dev/open_app#show", format: false }
        example.run
      end
    ensure
      Rails.configuration.x.expo_go_link_base = previous
    end

    before { allow(Rails.env).to receive(:development?).and_return(true) }

    (%w[confirm-email reset-password this-wasnt-me forgot-password my-data events my-events verification] +
      [ "events/5b0c2a4e-1f3d-4c8a-9b7e-0d2f6a1c3e5b" ]).each do |path|
      it "sends /#{path} to the same route in Expo Go, keeping the query" do
        get "/dev/open-app/#{path}?token=abc-123_XYZ&lang=fr"

        target = "exp://192.168.1.77:8081/--/#{path}?token=abc-123_XYZ&lang=fr"
        expect(response).to have_http_status(:ok)
        expect(response.media_type).to eq("text/html")
        expect(response.body).to include(%(window.top.location.href = #{ERB::Util.json_escape(target.to_json)}))
        expect(response.body).to include(%(href="#{target.gsub("&", "&amp;")}"))
        expect(response.body).to include("Ouvrir dans Expo Go / Open in Expo Go")
      end
    end

    it "works without a query" do
      get "/dev/open-app/forgot-password"

      expect(response.body).to include(%(href="exp://192.168.1.77:8081/--/forgot-password"))
    end

    it "keeps the token out of caches, Referer headers and search engines" do
      get "/dev/open-app/confirm-email?token=abc"

      expect(response.headers["Cache-Control"]).to eq("no-store")
      expect(response.headers["Referrer-Policy"]).to eq("no-referrer")
      expect(response.headers["X-Robots-Tag"]).to eq("noindex")
      expect(response.body).to include('<meta name="robots" content="noindex">')
    end

    it "doesn't log the token" do
      request = ActionDispatch::Request.new(Rack::MockRequest.env_for("/dev/open-app/confirm-email?token=abc"))
      request.env["action_dispatch.parameter_filter"] = Rails.application.config.filter_parameters

      expect(request.filtered_path).to eq("/dev/open-app/confirm-email?token=[FILTERED]")
    end

    it "returns 404 for a path the app doesn't open from a link" do
      [ "welcome", "confirm-email/extra", "admin", "https:/evil.example", "confirm-email.json", "events/1",
        "events/5b0c2a4e-1f3d-4c8a-9b7e-0d2f6a1c3e5b/extra", "my-events/x" ].each do |path|
        get "/dev/open-app/#{path}?token=abc"

        expect(response).to have_http_status(:not_found), "expected 404 for #{path}"
      end
    end

    it "escapes the query in the page" do
      get "/dev/open-app/confirm-email", params: {}, headers: {}, env: { "QUERY_STRING" => %(token="></a><script>x</script>) }

      expect(response.body).not_to include("<script>x</script>")
    end

    it "is still refused outside development even if the route were drawn" do
      allow(Rails.env).to receive(:development?).and_return(false)

      get "/dev/open-app/confirm-email?token=abc"

      expect(response).to have_http_status(:not_found)
    end
  end
end
