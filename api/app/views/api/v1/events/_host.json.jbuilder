json.host do
  json.id host.id
  json.first_name host.first_name
  json.last_name_initial host.last_name_initial
  json.photo_url nil
  json.verified host.verified?
end
