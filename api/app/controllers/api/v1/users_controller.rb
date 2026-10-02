module Api
  module V1
    # Another member's public profile (AC-6.1, AC-6.2, AC-6.4, AC-8.1, AC-8.2).
    class UsersController < BaseController
      def show
        @user = User.find(params[:id])
        raise ActiveRecord::RecordNotFound unless @user.visible_to_others?
      end
    end
  end
end
