require_relative "boot"

require "rails"
# Pick the frameworks you want:
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
require "active_storage/engine"
require "action_controller/railtie"
require "action_mailer/railtie"
# require "action_mailbox/engine"
# require "action_text/engine"
require "action_view/railtie"
# require "action_cable/engine"
# require "rails/test_unit/railtie"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module SparkCircles
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.1

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks])

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    config.time_zone = "Europe/Paris"
    config.i18n.available_locales = %i[fr en]
    config.i18n.default_locale = :fr

    # Active Record Encryption (spec US-10). Keys never live in the database or in git:
    # - production/staging: environment variables set in the host's secret manager;
    # - development: config/credentials/development.yml.enc (key file is git-ignored);
    # - test: throwaway keys in config/environments/test.rb.
    # Values set here override the credentials, so environment variables win when present.
    config.active_record.encryption.merge!({
      primary_key: ENV["ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY"],
      deterministic_key: ENV["ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY"],
      key_derivation_salt: ENV["ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT"]
    }.compact)
    # Never read or write sensitive columns in plain text by accident.
    config.active_record.encryption.support_unencrypted_data = false

    # UUID primary keys (uuidv7() is native in PostgreSQL 18), RSpec and FactoryBot generators.
    config.generators do |g|
      g.orm :active_record, primary_key_type: :uuid
      g.test_framework :rspec, fixture: false
      g.factory_bot dir: "spec/factories"
    end

    # Only loads a smaller set of middleware suitable for API only apps.
    # Middleware like session, flash, cookies can be added back manually.
    # Skip views, helpers and assets when generating a new resource.
    config.api_only = true
  end
end
