json.circle do
  json.partial! "api/v1/circles/public", circle: @circle, user: current_user
end
