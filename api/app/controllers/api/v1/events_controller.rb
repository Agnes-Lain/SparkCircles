module Api
  module V1
    # Events v1 (docs/api/events.md): search and detail for guests and members, and the
    # host's create, edit, publish, cancel and delete (US-1 to US-3, US-7, US-15).
    class EventsController < BaseController
      include GuestAccess
      include EventErrors

      allow_guests :index, limits: [ { to: 30, within: 1.minute, per: :device }, { to: 60, within: 1.minute, per: :ip },
                                     { to: 300, within: 1.hour, per: :device } ]
      allow_guests :show, limits: [ { to: 60, within: 1.minute, per: :device }, { to: 120, within: 1.minute, per: :ip } ]
      rate_limit to: 120, within: 1.minute, by: -> { current_user.id }, name: "member-read", store: GuestAccess::STORE,
                 with: :rate_limited, only: %i[index show], if: :current_user
      rate_limit to: 20, within: 1.hour, by: -> { current_user.id }, name: "create", store: GuestAccess::STORE,
                 with: :rate_limited, only: :create

      before_action :require_verified!, only: %i[create publish]
      before_action :set_hosted_event, only: %i[update destroy publish cancel]

      # AC-3.1 to AC-3.6, AC-3.10, AC-15.3, AC-15.12
      def index
        circle_ids = ::Events::Viewer.new(current_user).circle_ids
        search = ::Events::Search.new(params, guest: current_user.nil?, circle_ids: circle_ids)
        result = search.call
        @events = result.events
        @viewer = ::Events::Viewer.new(current_user, areas: search.areas).preload(@events)
        preload_insider_details(@events)
        @pagination = { page: result.page, per_page: ::Events::Search::PER_PAGE, next_page: result.next_page }
      rescue ::Events::Search::Invalid => e
        render_error(:unprocessable_content, :validation_failed, details: e.details)
      rescue ::Events::Search::TooBroad
        render_error(:unprocessable_content, :search_too_broad)
      end

      # AC-1.4, AC-6.1 to AC-6.4, AC-15.2, AC-15.11
      def show
        @event = Event.hosted.includes(:host, event_circles: :circle).find(params[:id])
        @viewer = ::Events::Viewer.new(current_user, areas: ::Events::Search.area_keys(params))
        raise ActiveRecord::RecordNotFound unless @viewer.can_see?(@event)
      end

      # AC-1.1 to AC-1.3: a draft, or published at once with "publish": true.
      def create
        @event = current_user.hosted_events.build(event_params)
        # AC-16.1: no language sent → the app's language (Accept-Language), changeable later.
        @event.language = I18n.locale.to_s if params.dig(:event, :language).blank?
        preset_approval
        refuse_switched_off_dropoff!
        saved = ActiveModel::Type::Boolean.new.cast(params[:publish]) ? @event.publish! : @event.save
        return render_validation_errors(@event) unless saved

        render_event(status: :created)
      end

      # AC-1.7, AC-2.5, AC-7.2, AC-8.7. Participants get one email with the net changes 10
      # minutes after the first edit (E2).
      # AC-5.8: under the event row lock, like joins, so "below_taken" is checked against the
      # places actually taken. The database check stays the last guard against a race.
      def update
        before = nil
        updated = Event.transaction do
          @event.lock!
          raise ::Events::Error.new(:event_not_editable) unless @event.editable?

          before = ::Events::Notifications.snapshot(@event)
          @event.assign_attributes(event_params)
          preset_approval if @event.draft?
          refuse_switched_off_dropoff!
          @event.save
        end
        return render_validation_errors(@event) unless updated

        ::Events::Notifications.event_edited(@event, before)
        # AC-17.18: fewer places can fill the event; the requests still waiting are closed.
        ::Events::Requests.new(@event).close_if_full if @event.published? && @event.full?

        render_event
      rescue ActiveRecord::CheckViolation => e
        raise unless e.message.include?("events_places_taken_check")

        render_error(:unprocessable_content, :validation_failed, details: { places_total: [ "below_taken" ] })
      end

      # AC-1.7: drafts only, permanent.
      def destroy
        raise ::Events::Error.new(:event_not_draft) unless @event.draft?

        @event.destroy!
        head :no_content
      end

      # AC-1.5, AC-1.6: verification checked again (require_verified!), start in the future.
      def publish
        raise ::Events::Error.new(:event_not_draft) unless @event.draft?
        refuse_switched_off_dropoff!
        return render_validation_errors(@event) unless @event.publish!

        render_event
      end

      # AC-7.3: participants are emailed at once (E3).
      def cancel
        raise ::Events::Error.new(:event_not_editable) unless (@event.published? || @event.suspended?) && !@event.ended?

        @event.cancel!
        ::Events::Notifications.event_cancelled(@event, neutral: false)
        render_event
      end

      private

      def set_hosted_event
        @event = current_user.hosted_events.find(params[:id])
      end

      def event_params
        # QA B4: `expect` answers 400 (bad_request) when `event` isn't an object.
        params.expect(event: [ :title, :description, :category, :starts_at, :ends_at, :area, :exact_address,
                               :places_total, :age_min, :age_max, :join_rule, :language, :adult_required,
                               :approval_required, :host_phone, :visibility, tags: [], circle_ids: [] ]).tap do |permitted|
          # US-16: saved with the event (Event#save_chosen_circles), checked by its validations.
          permitted[:chosen_circle_ids] = permitted.delete(:circle_ids) if permitted.key?(:circle_ids)
        end
      end

      # AC-17.8: approval is on by default for a drop-off event unless the host chose.
      def preset_approval
        return unless @event.dropoff? && @event.will_save_change_to_adult_required?
        return if params[:event].respond_to?(:key?) && params[:event].key?(:approval_required)

        @event.approval_required = true
      end

      # Web beta Q2: while drop-off events are switched off, none is created, turned into a
      # drop-off or published (drafts included). A published one stays editable by its host
      # (its adult setting is locked after publishing, AC-17.13).
      def refuse_switched_off_dropoff!
        return if Event.dropoff_enabled? || !@event.dropoff?
        return unless @event.new_record? || @event.draft? || @event.will_save_change_to_adult_required?

        raise ::Events::Error.new(:dropoff_disabled, status: :unprocessable_content)
      end

      def render_event(status: :ok)
        @viewer = ::Events::Viewer.new(current_user)
        render :show, status: status
      end

      # Participant lists only for the events where the viewer is host or participant.
      def preload_insider_details(events)
        insider = events.select { |event| %i[host participant].include?(@viewer.audience(event)) }
        ActiveRecord::Associations::Preloader.new(records: insider, associations: { participations: :user }).call if insider.any?
      end
    end
  end
end
