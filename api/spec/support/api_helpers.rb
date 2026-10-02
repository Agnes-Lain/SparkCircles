module ApiHelpers
  def json
    JSON.parse(response.body)
  end

  def error_code
    json.dig("error", "code")
  end

  # Logs a device in the same way POST /sessions does and returns its headers.
  def auth_headers(user, device_name: "test device")
    { "Authorization" => "Bearer #{user.issue_token!(device_name: device_name)}" }
  end

  def upload(name = "photo.jpg", content_type = "image/jpeg")
    Rack::Test::UploadedFile.new(Rails.root.join("spec/fixtures/files", name), content_type)
  end
end

RSpec.configure do |config|
  config.include ApiHelpers, type: :request
  config.include ActiveSupport::Testing::TimeHelpers
  config.include ActiveJob::TestHelper
end

RSpec::Matchers.define_negated_matcher :not_change, :change
RSpec::Matchers.define_negated_matcher :not_have_enqueued_mail, :have_enqueued_mail
