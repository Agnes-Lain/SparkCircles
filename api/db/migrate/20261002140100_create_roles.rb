# One account, several roles (AC-1.5, AC-1.7, AC-9.6). New roles (provider, support) are new values.
class CreateRoles < ActiveRecord::Migration[8.1]
  def change
    create_table :roles, id: :uuid, default: -> { "uuidv7()" } do |t|
      t.references :user, null: false, type: :uuid, foreign_key: { on_delete: :cascade }, index: false
      t.string :name, null: false
      t.uuid :granted_by_id # no foreign key: the granting admin may be erased later
      t.timestamps
    end
    add_index :roles, [ :user_id, :name ], unique: true
    add_check_constraint :roles, "name IN ('parent', 'admin')", name: "roles_name_check"
  end
end
