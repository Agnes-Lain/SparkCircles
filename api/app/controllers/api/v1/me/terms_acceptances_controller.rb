module Api
  module V1
    module Me
      # AC-5.5, AC-5.2: accept a new version of the terms and privacy policy.
      class TermsAcceptancesController < BaseController
        exempt_from_gates :terms_acceptance_required, only: :create

        def create
          legal = Rails.configuration.x.legal
          unless params[:terms_version] == legal[:terms_version] && params[:privacy_version] == legal[:privacy_version]
            return render_error(:unprocessable_content, :validation_failed, details: { terms_version: [ "invalid" ] })
          end

          current_user.accept_current_terms
          current_user.save!
          render_me
        end
      end
    end
  end
end
