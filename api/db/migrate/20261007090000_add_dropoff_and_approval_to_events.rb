# Drop-off events and host approval (spec events US-17, AC-17.1 to AC-17.25).
#
# Events: "accompanying adult required" (false = a drop-off event), "approval required",
# and the host's phone for a drop-off event (encrypted, AC-17.9, AC-17.12).
# Participations get a status: a request is "pending" until the host accepts or declines;
# only "accepted" rows hold places. An accepted participant asking for more places keeps
# their places and carries the extra request in pending_adults/pending_children (AC-17.21).
class AddDropoffAndApprovalToEvents < ActiveRecord::Migration[8.1]
  def change
    change_table :events, bulk: true do |t|
      t.boolean :adult_required, null: false, default: true
      t.boolean :approval_required, null: false, default: false
      t.text :host_phone # encrypted
    end
    # AC-17.3: a drop-off event is always "verified members only".
    add_check_constraint :events, "adult_required OR join_rule = 'verified_only'", name: "events_dropoff_join_rule_check"

    change_table :event_participations, bulk: true do |t|
      t.string :status, null: false, default: "accepted"
      t.string :closed_reason
      t.datetime :requested_at
      t.datetime :decided_at
      t.integer :pending_adults
      t.integer :pending_children
      t.text :emergency_phone # encrypted
      t.datetime :responsibility_acknowledged_at
    end
    add_index :event_participations, %i[event_id status requested_at]

    add_check_constraint :event_participations,
                         "status IN ('pending', 'accepted', 'declined', 'withdrawn', 'expired', 'closed')",
                         name: "event_participations_status_check"
    add_check_constraint :event_participations,
                         "closed_reason IS NULL OR closed_reason IN ('full', 'cancelled', 'verification')",
                         name: "event_participations_closed_reason_check"
    add_check_constraint :event_participations,
                         "(pending_adults IS NULL) = (pending_children IS NULL) AND " \
                         "(pending_adults IS NULL OR (pending_adults >= 0 AND pending_children >= 0 AND " \
                         "pending_adults + pending_children BETWEEN 1 AND 100))",
                         name: "event_participations_pending_counts_check"

    # AC-17.2: a drop-off booking may have 0 adults (the model checks which events allow it).
    reversible do |dir|
      dir.up do
        remove_check_constraint :event_participations, name: "event_participations_counts_check"
        add_check_constraint :event_participations, "adults >= 0 AND children >= 0 AND adults + children BETWEEN 1 AND 100",
                             name: "event_participations_counts_check"
      end
      dir.down do
        execute "DELETE FROM event_participations WHERE adults < 1"
        remove_check_constraint :event_participations, name: "event_participations_counts_check"
        add_check_constraint :event_participations, "adults >= 1 AND children >= 0 AND adults + children <= 100",
                             name: "event_participations_counts_check"
      end
    end
  end
end
