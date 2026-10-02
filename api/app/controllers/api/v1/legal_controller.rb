module Api
  module V1
    # Current terms and privacy policy versions (AC-5.1, AC-5.5).
    class LegalController < BaseController
      skip_before_action :authenticate_user!, :enforce_account_gates!

      def show
        legal = Rails.configuration.x.legal
        render json: {
          terms: { version: legal[:terms_version], url: legal[:terms_url] },
          privacy: { version: legal[:privacy_version], url: legal[:privacy_url] },
          requires_acceptance: legal[:requires_acceptance],
          changes: legal.dig(:changes, I18n.locale) || []
        }
      end
    end
  end
end
