# Copy of my data (US-12). The file is an encrypted Active Storage attachment.
class CreateDataExports < ActiveRecord::Migration[8.1]
  def change
    create_table :data_exports, id: :uuid, default: -> { "uuidv7()" } do |t|
      t.references :user, null: false, type: :uuid, foreign_key: { on_delete: :cascade }
      t.string :status, null: false, default: "pending"
      t.datetime :requested_at, null: false
      t.datetime :delivered_at
      t.datetime :expires_at
      t.timestamps
    end
    add_check_constraint :data_exports, "status IN ('pending', 'ready', 'expired')", name: "data_exports_status_check"
  end
end
