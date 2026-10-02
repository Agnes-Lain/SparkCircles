# Email changes that took effect, for the "This wasn't me" flow (AC-13.7, AC-13.8).
class CreateEmailChanges < ActiveRecord::Migration[8.1]
  def change
    create_table :email_changes, id: :uuid, default: -> { "uuidv7()" } do |t|
      t.references :user, null: false, type: :uuid, foreign_key: { on_delete: :cascade }
      t.text :previous_email, null: false                # encrypted
      t.text :new_email, null: false                     # encrypted
      t.datetime :changed_at, null: false
      t.datetime :reported_at
      t.datetime :restored_at
      t.uuid :restored_by_id
      t.timestamps
    end
    add_index :email_changes, :reported_at
  end
end
