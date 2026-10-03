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

seed_user("verified@sparkcircles.localhost", password: password, created: created, first_name: "Claire", last_name: "Martin",
          verification_status: "verified", verification_expires_on: 2.years.from_now.to_date, city_shown: "Croix-Rousse, Lyon")

pending = seed_user("pending@sparkcircles.localhost", password: password, created: created, first_name: "Thomas", last_name: "Renard",
                    verification_status: "pending", date_of_birth: Date.new(1988, 3, 14))
unless pending.verifications.exists?
  verification = pending.verifications.build(document_type: "national_id_card", submitted_at: 31.hours.ago,
                                             front_content_type: "image/png", back_content_type: "image/png",
                                             selfie_content_type: "image/png")
  %i[document_front document_back selfie].each { |name| verification.attach_encrypted(name, image, filename: name.to_s.dasherize) }
  verification.save!
end

puts "Seeded: admin@, verified@ and pending@sparkcircles.localhost."
if created.empty?
  puts "All three accounts already existed: they keep their current password."
elsif password_generated
  puts "Password of the accounts created now (#{created.join(', ')}), shown only once: #{password}"
  puts "Keep it in your password manager, or re-seed with SEED_PASSWORD=... to choose it."
else
  puts "Accounts created now (#{created.join(', ')}) use the password from SEED_PASSWORD."
end
puts "Back office: http://localhost:3000/admin (connect an authenticator app at the first login)."
