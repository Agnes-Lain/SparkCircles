# One row per logged-in device (devise-jwt Allowlist strategy, AC-3.4 to AC-3.6).
class CreateAllowlistedJwts < ActiveRecord::Migration[8.1]
  def change
    create_table :allowlisted_jwts, id: :uuid, default: -> { "uuidv7()" } do |t|
      t.references :user, null: false, type: :uuid, foreign_key: { on_delete: :cascade }
      t.string :jti, null: false
      t.string :aud
      t.datetime :exp, null: false
      t.datetime :last_used_at, null: false
      t.string :device_name
      t.timestamps
    end
    add_index :allowlisted_jwts, :jti, unique: true
    add_index :allowlisted_jwts, :last_used_at
  end
end
