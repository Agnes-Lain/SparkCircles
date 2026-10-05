# AC-15.13: no raw network address in the request log (see lib/middleware/hashed_ip_request_logger.rb).
require Rails.root.join("lib/middleware/hashed_ip_request_logger").to_s

Rails.application.config.middleware.swap Rails::Rack::Logger, HashedIpRequestLogger, Rails.application.config.log_tags
