module Api
  module V1
    module Me
      # AC-5.4: marketing choice applies at once and its date is recorded.
      class MarketingController < BaseController
        def update
          current_user.marketing_opt_in = params.require(:marketing_opt_in)
          current_user.save!
          render_me
        end
      end
    end
  end
end
