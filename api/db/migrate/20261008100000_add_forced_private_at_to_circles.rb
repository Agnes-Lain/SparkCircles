# QA B3 (PM decision 2026-10-07): a circle forced to private by SparkCircles staff stays
# private until staff lift it.
class AddForcedPrivateAtToCircles < ActiveRecord::Migration[8.1]
  def change
    add_column :circles, :forced_private_at, :datetime
    add_check_constraint :circles, "forced_private_at IS NULL OR visibility = 'private'", name: "circles_forced_private_check"
  end
end
