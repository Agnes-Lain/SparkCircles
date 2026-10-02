module Api
  module V1
    module Me
      # AC-4.4: change the password from settings; other devices are logged out.
      class PasswordsController < BaseController
        def update
          unless current_user.valid_password?(params.require(:current_password).to_s)
            return render_error(:unprocessable_content, :invalid_password)
          end

          password = params.require(:password).to_s
          current_user.password = password
          if current_user.save
            current_user.revoke_all_tokens!(except_jti: current_jti)
            render_me
          else
            render_validation_errors(current_user)
          end
        end
      end
    end
  end
end
