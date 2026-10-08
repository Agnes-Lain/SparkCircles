# Circles AC-6.5 (revised 2026-10-08): an admin who lost verification and was replaced by a
# verified member keeps a marker, so they return as co-admin when verified again (room allowing).
class AddFormerAdminAtToCircleMemberships < ActiveRecord::Migration[8.1]
  def change
    add_column :circle_memberships, :former_admin_at, :datetime
  end
end
