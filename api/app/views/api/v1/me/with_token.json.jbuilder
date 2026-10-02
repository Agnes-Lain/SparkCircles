json.token @token
if @user
  json.user do
    json.partial! "api/v1/me/me", user: @user
  end
else
  json.user nil
end
