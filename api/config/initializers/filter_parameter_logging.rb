# Be sure to restart your server when you modify this file.

# Configure parameters to be partially matched (e.g. passw matches password) and filtered from the log file.
# Use this to limit dissemination of sensitive information (spec AC-10.6).
# See the ActiveSupport::ParameterFilter documentation for supported notations and behaviors.
Rails.application.config.filter_parameters += [
  :passw, :email, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn, :cvv, :cvc,
  :last_name, :birth, :phone, :address, :neighborhood, :city, :ip_address, :document, :selfie, :note,
  # AC-15.13: nothing that describes a person's search, or what they wrote in a report, is
  # logged (exact names: "to", "from" or "page" as substrings would hide unrelated keys).
  # A list (area[]=…, also percent-encoded in a logged path) is hidden too.
  /\A(q|area|category|from|to|age_band|radius_km|page|details)(\[\]|%5B%5D)?\z/i, :tag
]
