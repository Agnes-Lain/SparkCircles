module Accounts
  # AC-12.1: everything SparkCircles holds about the user, in JSON. Never the ID images.
  class DataExportBuilder
    def initialize(user)
      @user = user
    end

    def to_json(*)
      JSON.pretty_generate(as_json)
    end

    def as_json(*)
      {
        generated_at: Time.current.utc.iso8601,
        account: {
          id: @user.id, first_name: @user.first_name, last_name: @user.last_name, email: @user.email,
          locale: @user.locale, roles: @user.role_names, created_at: iso(@user.created_at),
          email_confirmed_at: iso(@user.confirmed_at)
        },
        profile: { city_shown: @user.city_shown, date_of_birth: @user.date_of_birth&.iso8601 },
        consents: {
          adult_confirmed_at: iso(@user.adult_confirmed_at),
          terms_version: @user.terms_version, terms_accepted_at: iso(@user.terms_accepted_at),
          privacy_version: @user.privacy_version, privacy_accepted_at: iso(@user.privacy_accepted_at),
          marketing_opt_in: @user.marketing_opt_in, marketing_opt_in_changed_at: iso(@user.marketing_opt_in_changed_at)
        },
        verification: {
          status: @user.verification_status,
          expires_on: @user.verification_expires_on&.iso8601,
          history: @user.verifications.map { |verification| verification_entry(verification) }
        },
        email_changes: @user.email_changes.map do |change|
          { previous_email: change.previous_email, new_email: change.new_email, changed_at: iso(change.changed_at) }
        end,
        data_copy_requests: @user.data_exports.map do |export|
          { requested_at: iso(export.requested_at), delivered_at: iso(export.delivered_at) }
        end
      }
    end

    private

    def verification_entry(verification)
      {
        document_type: verification.document_type, submitted_at: iso(verification.submitted_at),
        outcome: verification.status, decided_at: iso(verification.decided_at),
        document_expires_on: verification.document_expires_on&.iso8601,
        rejection_reason: verification.rejection_reason, revoked_at: iso(verification.revoked_at)
      }
    end

    def iso(time) = time&.utc&.iso8601
  end
end
