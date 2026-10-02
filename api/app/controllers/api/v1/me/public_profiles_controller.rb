module Api
  module V1
    module Me
      # AC-6.3: "How others see me", exactly the public profile.
      class PublicProfilesController < BaseController
        def show
          @user = current_user
          render "api/v1/users/show"
        end
      end
    end
  end
end
