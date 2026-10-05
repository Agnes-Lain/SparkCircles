# AC-5.2: one place = one person attending; numbers only, no names, at least one adult.
class CreateEventParticipations < ActiveRecord::Migration[8.1]
  def change
    create_table :event_participations, id: :uuid, default: -> { "uuidv7()" } do |t|
      t.references :event, null: false, type: :uuid, foreign_key: { on_delete: :cascade }
      t.references :user, null: false, type: :uuid, foreign_key: { on_delete: :cascade }
      t.integer :adults, null: false, default: 1
      t.integer :children, null: false, default: 0
      t.virtual :places, type: :integer, as: "adults + children", stored: true
      t.timestamps
    end
    add_index :event_participations, %i[event_id user_id], unique: true
    add_check_constraint :event_participations, "adults >= 1 AND children >= 0 AND adults + children <= 100",
                         name: "event_participations_counts_check"
  end
end
