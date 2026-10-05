# Events v1 (spec events, US-1 to US-9). Random v4 ids: event ids can't be guessed or
# ordered (AC-15.12). Columns for v2 public open-data events (`source`, `external_id`,
# `source_url`) and v3 recurrence (`series_id`, `time_zone`) exist but aren't used yet.
class CreateEvents < ActiveRecord::Migration[8.1]
  CATEGORIES = %w[sport outdoors board_games video_games crafts music shows books workshops playdates other].freeze

  def change
    create_table :events, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :host, type: :uuid, foreign_key: { to_table: :users, on_delete: :cascade }
      t.string :source, null: false, default: "hosted"
      t.string :external_id
      t.string :source_url
      t.uuid :series_id
      t.string :status, null: false, default: "draft"
      t.string :suspension_reason
      t.string :visibility, null: false, default: "searchable"
      t.string :join_rule, null: false, default: "anyone"
      t.string :title, null: false, limit: 80
      t.text :description
      t.string :category, null: false
      t.string :tags, array: true, null: false, default: []
      t.datetime :starts_at, null: false
      t.datetime :ends_at, null: false
      t.string :time_zone, null: false, default: "Europe/Paris"
      t.string :area, null: false
      t.text :exact_address # encrypted
      t.integer :places_total
      t.integer :places_taken, null: false, default: 0
      t.integer :age_min
      t.integer :age_max
      t.datetime :published_at
      t.datetime :suspended_at
      t.datetime :cancelled_at
      t.timestamps
    end

    add_index :events, %i[status starts_at]
    add_index :events, %i[area starts_at]
    add_index :events, :ends_at
    add_index :events, :tags, using: :gin
    add_index :events, :series_id
    add_index :events, %i[source external_id], unique: true, where: "external_id IS NOT NULL"

    add_check_constraint :events, "source IN ('hosted', 'open_data')", name: "events_source_check"
    # A hosted event always has a host, an exact address and places; an imported one has
    # an external id and a source link instead (v2).
    add_check_constraint :events,
                         "(source = 'hosted' AND host_id IS NOT NULL AND exact_address IS NOT NULL AND places_total IS NOT NULL) OR " \
                         "(source = 'open_data' AND external_id IS NOT NULL AND source_url IS NOT NULL)",
                         name: "events_source_fields_check"
    add_check_constraint :events, "status IN ('draft', 'published', 'suspended', 'cancelled', 'past')", name: "events_status_check"
    add_check_constraint :events, "suspension_reason IS NULL OR suspension_reason IN ('host_unverified', 'admin')",
                         name: "events_suspension_reason_check"
    add_check_constraint :events, "visibility IN ('searchable')", name: "events_visibility_check"
    add_check_constraint :events, "join_rule IN ('anyone', 'verified_only')", name: "events_join_rule_check"
    add_check_constraint :events, "category IN (#{CATEGORIES.map { |key| "'#{key}'" }.join(', ')})", name: "events_category_check"
    add_check_constraint :events, "char_length(title) BETWEEN 1 AND 80", name: "events_title_length_check"
    add_check_constraint :events, "description IS NULL OR char_length(description) <= 1000", name: "events_description_length_check"
    add_check_constraint :events, "cardinality(tags) <= 5", name: "events_tags_count_check"
    add_check_constraint :events, "ends_at > starts_at", name: "events_time_order_check"
    add_check_constraint :events, "places_total IS NULL OR places_total BETWEEN 1 AND 100", name: "events_places_total_check"
    # AC-5.8: the total of places taken never exceeds the total, whatever the code does.
    add_check_constraint :events, "places_taken >= 0 AND (places_total IS NULL OR places_taken <= places_total)",
                         name: "events_places_taken_check"
    add_check_constraint :events, "(age_min IS NULL OR age_min BETWEEN 0 AND 17) AND (age_max IS NULL OR age_max BETWEEN 0 AND 17) " \
                                  "AND (age_min IS NULL OR age_max IS NULL OR age_min <= age_max)",
                         name: "events_age_range_check"
  end
end
