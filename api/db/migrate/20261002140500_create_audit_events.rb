# Append-only audit log (AC-10.4, AC-10.5). A trigger refuses any update, any
# truncate and any delete of entries younger than 13 months.
class CreateAuditEvents < ActiveRecord::Migration[8.1]
  def up
    create_table :audit_events, id: :uuid, default: -> { "uuidv7()" } do |t|
      t.uuid :actor_id            # no foreign keys: entries outlive erased accounts
      t.uuid :subject_user_id
      t.string :action, null: false
      t.string :fields, array: true, null: false, default: []
      t.string :reason
      t.text :ip_address          # encrypted
      t.jsonb :metadata, null: false, default: {}
      t.datetime :created_at, null: false
    end
    add_index :audit_events, :created_at
    add_index :audit_events, :subject_user_id
    add_index :audit_events, :actor_id

    execute <<~SQL
      CREATE FUNCTION audit_events_protect() RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'UPDATE' THEN
          RAISE EXCEPTION 'audit_events are append-only';
        ELSIF TG_OP = 'TRUNCATE' THEN
          RAISE EXCEPTION 'audit_events cannot be truncated';
        ELSIF OLD.created_at > now() - interval '13 months' THEN
          RAISE EXCEPTION 'audit_events are kept at least 13 months';
        END IF;
        RETURN OLD;
      END
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER audit_events_protect_rows BEFORE UPDATE OR DELETE ON audit_events
        FOR EACH ROW EXECUTE FUNCTION audit_events_protect();
      CREATE TRIGGER audit_events_protect_truncate BEFORE TRUNCATE ON audit_events
        FOR EACH STATEMENT EXECUTE FUNCTION audit_events_protect();
    SQL
  end

  def down
    drop_table :audit_events
    execute "DROP FUNCTION audit_events_protect()"
  end
end
