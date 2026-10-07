# AC-5.5: who did what, and when (first name and initial only).
person = lambda do |id|
  user = @people[id]
  user && { first_name: user.first_name, last_name_initial: user.last_name_initial }
end
json.entries @entries do |entry|
  json.action entry.action
  json.at entry.created_at.utc.iso8601
  json.actor person.call(entry.actor_id)
  json.subject person.call(entry.subject_user_id)
end
