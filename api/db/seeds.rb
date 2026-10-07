# Development data only. Never run in production.
#
# Password of the seeded accounts: set it yourself with
#   SEED_PASSWORD='choose-one-of-10+-characters' bin/rails db:seed
# Without SEED_PASSWORD a random one is generated and printed once at the end. No password is
# stored in this file. Accounts that already exist keep their current password.
return unless Rails.env.development?

require "securerandom"

password = ENV["SEED_PASSWORD"].presence || "#{SecureRandom.alphanumeric(16)}-#{SecureRandom.hex(4)}"
password_generated = ENV["SEED_PASSWORD"].blank?
created = []

# A plain grey 320x200 PNG standing in for the ID photos.
def placeholder_png(width = 320, height = 200)
  chunk = ->(type, data) { [ data.bytesize ].pack("N") + type + data + [ Zlib.crc32(type + data) ].pack("N") }
  rows = ("\x00".b + ("\xC8".b * width * 3)) * height
  "\x89PNG\r\n\x1A\n".b + chunk.call("IHDR", [ width, height, 8, 2, 0, 0, 0 ].pack("NNCCCCC")) +
    chunk.call("IDAT", Zlib::Deflate.deflate(rows)) + chunk.call("IEND", "")
end
image = placeholder_png

def seed_user(email, password:, created:, **attributes)
  User.find_by(email: email) || User.new(email: email, password: password, confirmed_at: Time.current,
                                         adult_confirmed_at: Time.current, locale: "en", **attributes).tap do |user|
    user.accept_current_terms
    user.skip_confirmation_notification!
    user.save!
    created << email
  end
end

admin = seed_user("admin@sparkcircles.localhost", password: password, created: created, first_name: "Agnes", last_name: "Admin")
admin.roles.find_or_create_by!(name: "admin")

claire = seed_user("verified@sparkcircles.localhost", password: password, created: created, first_name: "Claire", last_name: "Martin",
                   verification_status: "verified", verification_expires_on: 2.years.from_now.to_date, city_shown: "Croix-Rousse, Lyon")

# A second verified parent, in Paris, so each one can join the other's events.
karim = seed_user("verified-paris@sparkcircles.localhost", password: password, created: created, first_name: "Karim",
                  last_name: "Benali", verification_status: "verified", verification_expires_on: 2.years.from_now.to_date,
                  city_shown: "Paris 11e")

pending = seed_user("pending@sparkcircles.localhost", password: password, created: created, first_name: "Thomas", last_name: "Renard",
                    verification_status: "pending", date_of_birth: Date.new(1988, 3, 14))
unless pending.verifications.exists?
  verification = pending.verifications.build(document_type: "national_id_card", submitted_at: 31.hours.ago,
                                             front_content_type: "image/png", back_content_type: "image/png",
                                             selfie_content_type: "image/png")
  %i[document_front document_back selfie].each { |name| verification.attach_encrypted(name, image, filename: name.to_s.dasherize) }
  verification.save!
end

# Events v1 cold start (spec events, section 7, PM approved): published events from the seed
# verified accounts. Found again by host and title, so re-seeding never duplicates them; an
# event that has ended is moved to the coming days.
paris = ActiveSupport::TimeZone["Europe/Paris"]
[
  [ karim, "Foot au parc de Belleville", "sport", "paris-20", "Parc de Belleville, entrée rue Piat", 2, 10, 2, "anyone", %w[foot plein-air], 6, 10,
    "Petit match détendu pour les 6-10 ans. Ballon fourni, prévoir de l'eau." ],
  [ karim, "Goûter jeux de société", "board_games", "paris-11", "Café ludique, rue Oberkampf", 4, 16, 2, "verified_only", %w[jeux goûter], 5, 9,
    "On apporte nos jeux préférés et un goûter à partager." ],
  [ claire, "Atelier peinture en plein air", "crafts", "paris-12", "Jardin de Reuilly, près du kiosque", 6, 10, 2, "anyone", %w[peinture dessin], 4, 8,
    "Chevalets et peintures fournis, tabliers bienvenus." ],
  [ claire, "Heure du conte", "books", "paris-05", "Square Paul-Langevin", 9, 11, 1, "anyone", %w[histoires], 3, 6,
    "Lecture d'albums sur une couverture, puis échange de livres." ],
  [ karim, "Éveil musical", "music", "paris-10", "Jardin Villemin, côté canal", 12, 10, 1, "anyone", %w[chant musique], 0, 3,
    "Comptines et petites percussions pour les tout-petits." ]
].each do |host, title, category, area, address, in_days, hour, hours, join_rule, tags, age_min, age_max, description|
  event = Event.find_or_initialize_by(host: host, title: title)
  next if event.persisted? && !event.ended?

  starts_at = paris.now.to_date.advance(days: in_days).then { |day| paris.local(day.year, day.month, day.day, hour) }
  event.assign_attributes(category: category, area: area, exact_address: address, places_total: 12, join_rule: join_rule, tags: tags,
                          age_min: age_min, age_max: age_max, description: description, starts_at: starts_at,
                          ends_at: starts_at + hours.hours)
  event.status = "draft" unless event.persisted?
  event.status == "draft" ? event.publish! : event.update!(status: "published")
  raise "Seed event #{title} invalid: #{event.errors.full_messages.join(', ')}" unless event.published?
end

# US-17: a drop-off event with host approval (Claire hosts, Karim can send a request). The
# phone number is fictional.
dropoff = Event.find_or_initialize_by(host: claire, title: "Après-midi jeux chez moi")
if dropoff.new_record? || dropoff.ended?
  starts_at = paris.now.to_date.advance(days: 5).then { |day| paris.local(day.year, day.month, day.day, 15) }
  dropoff.assign_attributes(category: "playdates", area: "paris-11", exact_address: "8 rue de la Roquette, 75011 Paris",
                            places_total: 6, adult_required: false, approval_required: true, age_min: 4, age_max: 8,
                            host_phone: "06 01 02 03 04", tags: %w[jeux], starts_at: starts_at, ends_at: starts_at + 3.hours,
                            description: "Jeux de société et goûter. Tu peux me confier tes enfants pour l'après-midi.")
  dropoff.status = "draft" unless dropoff.persisted?
  dropoff.status == "draft" ? dropoff.publish! : dropoff.update!(status: "published")
  raise "Seed event #{dropoff.title} invalid: #{dropoff.errors.full_messages.join(', ')}" unless dropoff.published?
end

# Circles v1 (spec circles): Karim runs a public circle (Claire is a member, Thomas, not
# verified, is waiting for approval) with a circle-only outing; Claire runs a private circle
# and a second public one, so search has results. Found again by name: never duplicated.
def seed_circle(name, admin:, area:, visibility:, description:)
  Circle.find_by(name: name) || Circle.create!(name: name, area: area, visibility: visibility, description: description,
                                               created_by: admin).tap do |circle|
    circle.memberships.create!(user: admin, status: "active", role: "admin", creator: true, joined_at: Time.current,
                               admin_since: Time.current, seen_at: Time.current)
  end
end

def seed_membership(circle, user, status: "active")
  circle.memberships.find_or_create_by!(user: user) do |membership|
    membership.status = status
    membership.joined_at = Time.current if status == "active"
    membership.requested_at = Time.current if status == "pending"
    membership.seen_at = Time.current
  end
end

class_circle = seed_circle("Parents CE2 · Jaurès", admin: karim, area: "paris-11", visibility: "public",
                           description: "Les familles de la classe de Mme Roux, pour s'organiser pour les sorties d'école.")
seed_membership(class_circle, claire)
seed_membership(class_circle, pending, status: "pending")
neighbours = seed_circle("Voisins de la Roquette", admin: claire, area: "paris-11", visibility: "private",
                         description: "Les familles de l'immeuble.")
seed_circle("Goûters du 20e", admin: claire, area: "paris-20", visibility: "public",
            description: "Des goûters au parc de Belleville, un mercredi sur deux.")

circle_outing = Event.find_or_initialize_by(host: karim, title: "Goûter et jeux au parc")
if circle_outing.new_record? || circle_outing.ended?
  starts_at = paris.now.to_date.advance(days: 3).then { |day| paris.local(day.year, day.month, day.day, 15) }
  circle_outing.assign_attributes(category: "playdates", area: "paris-11", exact_address: "Square Maurice-Gardette", places_total: 12,
                                  join_rule: "anyone", visibility: "circles", chosen_circle_ids: [ class_circle.id ], tags: %w[goûter],
                                  starts_at: starts_at, ends_at: starts_at + 2.hours, description: "Goûter partagé après l'école.")
  circle_outing.status = "draft" unless circle_outing.persisted?
  circle_outing.status == "draft" ? circle_outing.publish! : circle_outing.update!(status: "published")
  raise "Seed event #{circle_outing.title} invalid: #{circle_outing.errors.full_messages.join(', ')}" unless circle_outing.published?
end

link_base = Rails.configuration.x.app_link_base
puts "Circles: « #{class_circle.name} » (Karim, public, code #{class_circle.formatted_code}), " \
     "« #{neighbours.name} » (Claire, private, code #{neighbours.formatted_code}, link #{link_base}/join/#{neighbours.invite_token})."
puts "Seeded: admin@, verified@, verified-paris@ and pending@sparkcircles.localhost, and #{Event.listed.count} upcoming events."
if created.empty?
  puts "The accounts already existed: they keep their current password."
elsif password_generated
  puts "Password of the accounts created now (#{created.join(', ')}), shown only once: #{password}"
  puts "Keep it in your password manager, or re-seed with SEED_PASSWORD=... to choose it."
else
  puts "Accounts created now (#{created.join(', ')}) use the password from SEED_PASSWORD."
end
puts "Back office: http://localhost:3000/admin (connect an authenticator app at the first login)."
