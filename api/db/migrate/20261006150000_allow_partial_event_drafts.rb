# Drafts save whatever the host typed (PM decision 2026-10-06, QA BUG-8): only the host
# is required on a draft. Every other field is required once the event leaves the draft
# state, and the database keeps that rule too.
class AllowPartialEventDrafts < ActiveRecord::Migration[8.1]
  REQUIRED = %i[title category starts_at ends_at area].freeze

  def up
    REQUIRED.each { |column| change_column_null :events, column, true }
    remove_check_constraint :events, name: "events_source_fields_check"
    add_check_constraint :events,
                         "(source = 'hosted' AND host_id IS NOT NULL AND (status = 'draft' OR " \
                         "(exact_address IS NOT NULL AND places_total IS NOT NULL))) OR " \
                         "(source = 'open_data' AND external_id IS NOT NULL AND source_url IS NOT NULL)",
                         name: "events_source_fields_check"
    add_check_constraint :events, "status = 'draft' OR (#{REQUIRED.map { |column| "#{column} IS NOT NULL" }.join(' AND ')})",
                         name: "events_required_unless_draft_check"
  end

  def down
    remove_check_constraint :events, name: "events_required_unless_draft_check"
    remove_check_constraint :events, name: "events_source_fields_check"
    add_check_constraint :events,
                         "(source = 'hosted' AND host_id IS NOT NULL AND exact_address IS NOT NULL AND places_total IS NOT NULL) OR " \
                         "(source = 'open_data' AND external_id IS NOT NULL AND source_url IS NOT NULL)",
                         name: "events_source_fields_check"
    REQUIRED.each { |column| change_column_null :events, column, false }
  end
end
