# Event language (spec events, amendment 2026-10-06, AC-16.1 to AC-16.3): French or
# English, set by the host. Existing events were all written in French.
class AddLanguageToEvents < ActiveRecord::Migration[8.1]
  def change
    add_column :events, :language, :string, null: false, default: "fr"
    add_check_constraint :events, "language IN ('fr', 'en')", name: "events_language_check"
  end
end
