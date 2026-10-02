namespace :admin do
  desc "Give the admin role to an existing, confirmed account (first admin only; then use the back office). EMAIL=..."
  task grant: :environment do
    user = User.find_by(email: ENV.fetch("EMAIL").strip.downcase)
    abort "No account uses this email." unless user
    abort "This account hasn't confirmed its email yet." unless user.confirmed?

    User.transaction do
      user.roles.find_or_create_by!(name: "admin")
      AuditEvent.record!(action: "granted_admin_role", subject: user, metadata: { via: "rake admin:grant" })
    end
    puts "#{user.display_name} is now an admin. They connect an authenticator app at their first back office login."
  end
end
