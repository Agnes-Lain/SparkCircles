# US-9: reports reach the admin queue; the host never learns who reported (AC-9.2).
class CreateEventReports < ActiveRecord::Migration[8.1]
  def change
    create_table :event_reports, id: :uuid, default: -> { "uuidv7()" } do |t|
      t.references :event, null: false, type: :uuid, foreign_key: { on_delete: :cascade }
      t.references :reporter, type: :uuid, foreign_key: { to_table: :users, on_delete: :nullify }
      t.string :reason, null: false
      t.text :details # encrypted
      t.datetime :resolved_at
      t.uuid :resolved_by_id
      t.timestamps
    end
    add_index :event_reports, %i[event_id reporter_id], unique: true
    add_index :event_reports, :resolved_at
    add_check_constraint :event_reports,
                         "reason IN ('dangerous_place', 'suspicious_host', 'inappropriate_content', 'inappropriate_tag', 'other')",
                         name: "event_reports_reason_check"
  end
end
