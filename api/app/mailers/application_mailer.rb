class ApplicationMailer < ActionMailer::Base
  default from: -> { ENV.fetch("MAIL_FROM", "SparkCircles <hello@sparkcircles.localhost>") }
  layout "mailer"

  private

  # Links in emails open the mobile app. Tokens are one-time values, not personal data.
  def app_link(path, token = nil)
    url = "#{Rails.configuration.x.app_link_base}/#{path}"
    token ? "#{url}?#{{ token: token }.to_query}" : url
  end
end
