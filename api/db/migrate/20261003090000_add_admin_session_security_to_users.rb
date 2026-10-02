# BUG-01, BUG-04: back office login state kept on the server, not only in the cookie.
# - admin_session_digest: digest of the nonce held by the one valid back office session
#   (pending second factor or logged in). Rotated on every step, cleared at logout.
# - otp_failed_attempts / otp_locked_until: wrong authenticator codes, counted server-side.
class AddAdminSessionSecurityToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :admin_session_digest, :string
    add_column :users, :otp_failed_attempts, :integer, null: false, default: 0
    add_column :users, :otp_locked_until, :datetime
  end
end
