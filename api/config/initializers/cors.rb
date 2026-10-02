# Be sure to restart your server when you modify this file.
#
# The native mobile app doesn't need CORS. Browsers do: we only allow local
# development origins (Expo web, local tools). Production origins get added
# explicitly when a browser client exists. Read more: https://github.com/cyu/rack-cors

if Rails.env.development?
  Rails.application.config.middleware.insert_before 0, Rack::Cors do
    allow do
      origins %r{\Ahttp://(localhost|127\.0\.0\.1)(:\d+)?\z}

      resource "*",
        headers: :any,
        expose: %w[Authorization],
        methods: %i[get post put patch delete options head]
    end
  end
end
