# Event notification emails waiting for their batching window or for the end of quiet
# hours (docs/design/events-emails.md section 3). One row per batch:
# - host_activity: per event, the net places change of each participant (user id and two
#   numbers, never adults/children);
# - event_changed: per event, the state before the first edit (no exact address: only a
#   digest to tell that it changed);
# - host_status: per host, the events put on hold or resumed.
class CreatePendingEventNotifications < ActiveRecord::Migration[8.1]
  def change
    create_table :pending_event_notifications, id: :uuid, default: -> { "uuidv7()" } do |t|
      t.string :kind, null: false
      t.references :event, type: :uuid, foreign_key: { on_delete: :cascade }, index: false
      t.references :host, type: :uuid, foreign_key: { to_table: :users, on_delete: :cascade }, index: false
      t.jsonb :payload, null: false, default: {}
      t.datetime :deliver_at
      t.datetime :throttle_until
      t.timestamps
    end
    add_index :pending_event_notifications, %i[kind event_id], unique: true, where: "event_id IS NOT NULL"
    add_index :pending_event_notifications, %i[kind host_id], unique: true, where: "host_id IS NOT NULL"
    add_check_constraint :pending_event_notifications, "kind IN ('host_activity', 'event_changed', 'host_status')",
                         name: "pending_event_notifications_kind_check"
    add_check_constraint :pending_event_notifications, "(event_id IS NULL) <> (host_id IS NULL)",
                         name: "pending_event_notifications_subject_check"
  end
end
