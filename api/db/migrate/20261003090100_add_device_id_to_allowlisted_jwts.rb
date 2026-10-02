# BUG-13: device tokens are renewed while the device is used, so one device can hold
# a fresh token and the previous one for a short while. device_id groups them, so
# "log out this device" removes both (AC-3.4, AC-3.5).
class AddDeviceIdToAllowlistedJwts < ActiveRecord::Migration[8.1]
  def change
    add_column :allowlisted_jwts, :device_id, :uuid, null: false, default: -> { "gen_random_uuid()" }
    add_index :allowlisted_jwts, [ :user_id, :device_id ]
  end
end
