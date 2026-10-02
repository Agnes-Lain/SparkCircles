# Identity verifications (US-7, US-9). Images are Active Storage attachments,
# encrypted before upload and erased 30 days after the decision (AC-7.10).
class CreateVerifications < ActiveRecord::Migration[8.1]
  def change
    create_table :verifications, id: :uuid, default: -> { "uuidv7()" } do |t|
      t.references :user, null: false, type: :uuid, foreign_key: { on_delete: :cascade }
      t.string :status, null: false, default: "pending"
      t.string :document_type, null: false
      t.datetime :submitted_at, null: false
      t.string :front_content_type
      t.string :back_content_type
      t.string :selfie_content_type

      # Decision (AC-7.6, AC-7.7, AC-9.2)
      t.datetime :decided_at
      t.uuid :reviewer_id
      t.text :document_expires_on                        # encrypted
      t.string :rejection_reason
      t.text :note                                       # encrypted

      # Revocation (AC-7.9)
      t.datetime :revoked_at
      t.uuid :revoked_by_id
      t.string :revocation_reason
      t.text :revocation_note                            # encrypted

      t.datetime :files_purged_at
      t.timestamps
    end
    # At most one pending verification per user (AC-7.5).
    add_index :verifications, :user_id, unique: true, where: "status = 'pending'", name: "index_verifications_one_pending_per_user"
    add_index :verifications, [ :status, :submitted_at ]
    add_index :verifications, :decided_at
    add_check_constraint :verifications, "status IN ('pending', 'approved', 'rejected')", name: "verifications_status_check"
    add_check_constraint :verifications,
      "document_type IN ('passport', 'national_id_card', 'driving_licence', 'residence_permit', 'other_residence_card')",
      name: "verifications_document_type_check"
  end
end
