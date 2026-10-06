# AC-11.7: someone who closed their account is a "Former member".
shown = user.visible_to_others?
json.first_name(shown ? user.first_name : nil)
json.last_name_initial(shown ? user.last_name_initial : nil)
json.verified(shown && user.verified?)
json.former_member !shown
