# AC-2.1: the link and the short code, for admins only.
json.invitation do
  json.link "#{Rails.configuration.x.app_link_base}/join/#{@circle.invite_token}"
  json.code @circle.formatted_code
  json.enabled @circle.invite_enabled
  json.renewed_at @circle.invite_renewed_at.utc.iso8601
  json.full @circle.full?
end
