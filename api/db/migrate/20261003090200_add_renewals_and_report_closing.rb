# AC-7.15: a verification submitted while the parent is still verified is a renewal.
# AC-13.10: an admin can close a "This wasn't me" report without restoring the email;
# the reason they write is kept, encrypted, in the audit log.
class AddRenewalsAndReportClosing < ActiveRecord::Migration[8.1]
  def change
    add_column :verifications, :renewal, :boolean, null: false, default: false

    add_column :email_changes, :closed_at, :datetime
    add_column :email_changes, :closed_by_id, :uuid

    add_column :audit_events, :note, :text # encrypted
  end
end
