# BUG-06: UUIDv7 ids embed their creation time to the millisecond, which would reveal
# the erasure day. Statistics keep months only (AC-11.6), so their ids are fully random.
class UseRandomIdsForClosedAccountStatistics < ActiveRecord::Migration[8.1]
  def change
    change_column_default :closed_account_statistics, :id, from: -> { "uuidv7()" }, to: -> { "gen_random_uuid()" }
  end
end
