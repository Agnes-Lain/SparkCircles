# Circles v1 (spec circles US-1 to US-9, US-16, US-17).
#
# - circles: a small group of families. Public by default, private flagged as a premium
#   entitlement (free during the test phase, PM decision 2026-10-07). The invitation link
#   token and code are encrypted (admins see them again) with a keyed digest for lookup.
# - circle_memberships: one row per circle and person: a join request ("pending") until
#   an admin decides, then "active"; "declined" and "removed" rows block new requests
#   (AC-2.7); "expired", "cancelled" and "left" rows let the person ask again.
# - circle_reports: reports about a circle or one of its members (AC-7.1, AC-7.2).
# - event_circles: the circles a circle-only event is visible to (US-16).
class CreateCircles < ActiveRecord::Migration[8.1]
  def change
    create_table :circles, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.string :name, limit: 50, null: false
      t.text :description
      t.string :area, null: false
      t.string :visibility, null: false, default: "public"
      t.string :premium_entitlement
      t.datetime :visibility_changed_at
      t.string :status, null: false, default: "active"
      t.date :closes_on
      t.datetime :suspended_at
      t.datetime :closed_at
      t.references :created_by, type: :uuid, foreign_key: { to_table: :users, on_delete: :nullify }
      t.text :invite_token # encrypted
      t.string :invite_token_digest, null: false
      t.text :invite_code # encrypted
      t.string :invite_code_digest, null: false
      t.boolean :invite_enabled, null: false, default: true
      t.datetime :invite_renewed_at, null: false
      t.datetime :last_request_email_at
      t.datetime :request_digest_due_at
      t.timestamps
    end
    add_index :circles, :invite_token_digest, unique: true
    add_index :circles, :invite_code_digest, unique: true
    add_index :circles, %i[visibility status area]
    add_check_constraint :circles, "visibility IN ('public', 'private')", name: "circles_visibility_check"
    add_check_constraint :circles, "status IN ('active', 'suspended', 'closed')", name: "circles_status_check"
    add_check_constraint :circles, "char_length(name) BETWEEN 3 AND 50", name: "circles_name_length_check"
    add_check_constraint :circles, "description IS NULL OR char_length(description) <= 200",
                         name: "circles_description_length_check"
    add_check_constraint :circles, "premium_entitlement IS NULL OR premium_entitlement IN ('test_phase_free')",
                         name: "circles_premium_entitlement_check"

    create_table :circle_memberships, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :circle, null: false, type: :uuid, foreign_key: { on_delete: :cascade }, index: false
      t.references :user, null: false, type: :uuid, foreign_key: { on_delete: :cascade }
      t.string :status, null: false
      t.string :role, null: false, default: "member"
      t.boolean :creator, null: false, default: false
      t.datetime :requested_at
      t.datetime :decided_at
      t.datetime :joined_at
      t.datetime :admin_since
      t.datetime :seen_at
      t.datetime :dismissed_at
      t.timestamps
    end
    add_index :circle_memberships, %i[circle_id user_id], unique: true
    add_index :circle_memberships, %i[circle_id status]
    add_check_constraint :circle_memberships,
                         "status IN ('pending', 'active', 'declined', 'expired', 'cancelled', 'left', 'removed')",
                         name: "circle_memberships_status_check"
    add_check_constraint :circle_memberships, "role IN ('member', 'admin')", name: "circle_memberships_role_check"
    add_check_constraint :circle_memberships, "role = 'member' OR status = 'active'", name: "circle_memberships_admin_active_check"

    create_table :circle_reports, id: :uuid, default: -> { "uuidv7()" } do |t|
      t.references :circle, null: false, type: :uuid, foreign_key: { on_delete: :cascade }
      t.references :reporter, type: :uuid, foreign_key: { to_table: :users, on_delete: :nullify }
      t.references :reported_user, type: :uuid, foreign_key: { to_table: :users, on_delete: :nullify }
      t.string :reason, null: false
      t.text :details # encrypted
      t.datetime :resolved_at
      t.uuid :resolved_by_id
      t.timestamps
    end
    add_index :circle_reports, :resolved_at
    add_check_constraint :circle_reports,
                         "reason IN ('unsafe', 'not_real_group', 'inappropriate_behaviour', 'child_safety', 'fake_identity', 'other')",
                         name: "circle_reports_reason_check"

    create_table :event_circles, primary_key: %i[event_id circle_id] do |t|
      t.references :event, null: false, type: :uuid, foreign_key: { on_delete: :cascade }, index: false
      t.references :circle, null: false, type: :uuid, foreign_key: { on_delete: :cascade }
      t.datetime :created_at, null: false, default: -> { "CURRENT_TIMESTAMP" }
    end

    # US-16: an event can be visible to chosen circles only.
    remove_check_constraint :events, "visibility = 'searchable'", name: "events_visibility_check"
    add_check_constraint :events, "visibility IN ('searchable', 'circles')", name: "events_visibility_check"
  end
end
