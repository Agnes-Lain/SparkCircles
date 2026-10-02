# Non-identifying statistics kept after an account is erased (AC-11.5, AC-11.6):
# no user ID, no exact dates (months only), no timestamps.
class CreateClosedAccountStatistics < ActiveRecord::Migration[8.1]
  def change
    create_table :closed_account_statistics, id: :uuid, default: -> { "uuidv7()" } do |t|
      t.date :signup_month, null: false
      t.date :closure_month, null: false
      t.boolean :was_verified, null: false
    end
  end
end
