# The owner's own account. Never rendered for anyone else (AC-6.2).
json.id user.id
json.first_name user.first_name
json.last_name user.last_name
json.email user.email
json.pending_email user.pending_reconfirmation? ? user.unconfirmed_email : nil
json.city_shown user.city_shown
json.locale user.locale
json.roles user.role_names
json.email_confirmed user.confirmed?
json.terms_acceptance_required user.terms_acceptance_required?
json.closure(user.closed? ? { closed_at: user.closed_at.utc.iso8601, erasure_on: user.erasure_on.iso8601 } : nil)
json.marketing_opt_in user.marketing_opt_in
json.marketing_opt_in_changed_at user.marketing_opt_in_changed_at&.utc&.iso8601
json.consents do
  json.terms_version user.terms_version
  json.terms_accepted_at user.terms_accepted_at&.utc&.iso8601
  json.privacy_version user.privacy_version
  json.privacy_accepted_at user.privacy_accepted_at&.utc&.iso8601
end
json.verification do
  json.partial! "api/v1/verifications/verification", user: user
end
