# Preview every circle email in development: http://localhost:3000/rails/mailers/circle_mailer
# Add ?locale=en or ?locale=fr to the URL to switch language (French by default).
class CircleMailerPreview < ActionMailer::Preview
  def request_received = CircleMailer.request_received(circle, admin, person("Inès", "Bah"))
  def requests_digest = CircleMailer.requests_digest(circle, admin, 3)
  def request_accepted = CircleMailer.request_accepted(circle, member)
  def request_declined = CircleMailer.request_declined(circle, member)
  def request_expired = CircleMailer.request_expired(circle, member)
  def event_access_lost_left = CircleMailer.event_access_lost(event, member, :left)
  def event_access_lost_removed = CircleMailer.event_access_lost(event, member, :removed)
  def new_admin = CircleMailer.new_admin(circle, member)
  def new_admin_no_verified_admin = CircleMailer.new_admin(circle, member, "no_verified_admin")
  def circle_closing = CircleMailer.circle_closing(circle.tap { |c| c.closes_on = 30.days.from_now.to_date }, member)

  private

  # In-memory records: previews never touch real accounts or circles.
  def person(first_name, last_name)
    User.new(id: SecureRandom.uuid, first_name: first_name, last_name: last_name, email: "#{first_name.downcase}@example.com",
             locale: params[:locale] || "fr", confirmed_at: Time.current)
  end

  def admin = @admin ||= person("Claire", "Dubois")
  def member = @member ||= person("Léa", "Petit")
  def circle = @circle ||= Circle.new(id: SecureRandom.uuid, name: "Parents CE2 · Jaurès", area: "paris-11")
  def event = Event.new(id: SecureRandom.uuid, title: "Goûter et jeux au parc", starts_at: 3.days.from_now, time_zone: "Europe/Paris")
end
