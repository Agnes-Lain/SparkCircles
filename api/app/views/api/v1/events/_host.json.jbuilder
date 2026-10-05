# AC-11.2, AC-11.7: a closed (or erased) host is shown as "Former member": no id, no name,
# no photo, no badge. The app shows the neutral "?" avatar.
json.host do
  if host&.visible_to_others?
    json.id host.id
    json.first_name host.first_name
    json.last_name_initial host.last_name_initial
    json.photo_url nil
    json.verified host.verified?
    json.former_member false
  else
    json.id nil
    json.first_name nil
    json.last_name_initial nil
    json.photo_url nil
    json.verified false
    json.former_member true
  end
end
