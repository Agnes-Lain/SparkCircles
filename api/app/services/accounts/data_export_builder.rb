module Accounts
  # AC-12.1: everything SparkCircles holds about the user, in JSON, including their history
  # (hosted events, participations, reports sent). Never the ID images.
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
        end,
        hosted_events: @user.hosted_events.order(:starts_at).map { |event| hosted_event_entry(event) },
        event_participations: @user.event_participations.includes(:event).order(:created_at).map do |participation|
          participation_entry(participation)
        end,
        event_reports: @user.event_reports.includes(:event).order(:created_at).map { |report| report_entry(report) }
      }
    end

    private

    # Events spec section 7: the user's own events, with the exact address (theirs). Other
    # people's data (who joined) is not part of this user's copy: counts only.
    def hosted_event_entry(event)
      {
        id: event.id, status: event.display_status, title: event.title, description: event.description,
        category: event.category, tags: event.tags, starts_at: iso(event.starts_at), ends_at: iso(event.ends_at),
        time_zone: event.time_zone, area: event.area, exact_address: event.exact_address,
        age_min: event.age_min, age_max: event.age_max, join_rule: event.join_rule, visibility: event.visibility,
        places_total: event.places_total, places_taken: event.places_taken,
        created_at: iso(event.created_at), published_at: iso(event.published_at),
        suspended_at: iso(event.suspended_at), cancelled_at: iso(event.cancelled_at)
      }
    end

    def participation_entry(participation)
      event = participation.event
      {
        event_id: event.id, event_title: event.title, event_starts_at: iso(event.starts_at),
        event_ends_at: iso(event.ends_at), event_area: event.area,
        adults: participation.adults, children: participation.children, places: participation.requested_places,
        joined_at: iso(participation.created_at), updated_at: iso(participation.updated_at)
      }
    end

    def report_entry(report)
      {
        event_id: report.event_id, event_title: report.event.title, reason: report.reason, details: report.details,
        reported_at: iso(report.created_at)
      }
    end

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
