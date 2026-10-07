json.circle do
  if @circle.active?
    json.partial! "api/v1/circles/member", circle: @circle, policy: @policy, user: current_user
  else
    # AC-7.3, AC-9.3: a paused or closed circle shows nothing else.
    json.id @circle.id
    json.audience "member"
    json.status @circle.status
  end
end
