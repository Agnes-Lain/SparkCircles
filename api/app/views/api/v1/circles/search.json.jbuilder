json.circles @circles do |circle|
  json.partial! "api/v1/circles/public", circle: circle, user: current_user
end
json.pagination @pagination
