# AC-15.13: technical security log of anonymous traffic (rate-limit hits, blocks, refused
# clients). Only a keyed hash of the network address; rows are deleted after 30 days.
class CreateGuestAccessEvents < ActiveRecord::Migration[8.1]
  def change
    create_table :guest_access_events, id: :uuid, default: -> { "uuidv7()" } do |t|
      t.string :kind, null: false
      t.string :ip_hash, null: false, limit: 32
      t.string :endpoint, null: false, limit: 100
      t.datetime :created_at, null: false
    end
    add_index :guest_access_events, :created_at
    add_check_constraint :guest_access_events, "kind IN ('rate_limited', 'blocked', 'client_refused')",
                         name: "guest_access_events_kind_check"
  end
end
