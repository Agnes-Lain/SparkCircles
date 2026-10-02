# QA R2-03: the password step gets its own server-side nonce, so a pending login
# (password without the code) never ends the admin's live back office session.
class AddAdminPendingDigestToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :admin_pending_digest, :string
  end
end
