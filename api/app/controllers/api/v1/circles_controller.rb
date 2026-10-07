module Api
  module V1
    # Circles v1 (docs/api/circles.md): my circles, create, detail or public page, edit,
    # delete, search, and the admins' activity log (spec circles US-1, US-4, US-6, US-9, US-17).
    class CirclesController < BaseController
      include GuestAccess
      include CircleAccess

      allow_guests :search, limits: [ { to: 30, within: 1.minute, per: :device }, { to: 60, within: 1.minute, per: :ip },
                                      { to: 300, within: 1.hour, per: :device } ]
      allow_guests :show, limits: [ { to: 60, within: 1.minute, per: :device }, { to: 120, within: 1.minute, per: :ip } ]
      rate_limit to: 120, within: 1.minute, by: -> { current_user.id }, name: "circle-read", store: GuestAccess::STORE,
                 with: :rate_limited, only: %i[index show search], if: :current_user
      rate_limit to: 20, within: 1.hour, by: -> { current_user.id }, name: "circle-write", store: GuestAccess::STORE,
                 with: :rate_limited, only: %i[create update destroy]

      before_action :require_verified!, only: :create
      before_action :find_circle, only: %i[show update destroy activity]

      # AC-9.1 to AC-9.3, AC-3.6, AC-2.6
      def index
        @list = ::Circles::MyCircles.new(current_user)
        @items = @list.items
        @limits = @list.limits
      end

      # Member: the detail (or the paused/closed status). Non-member or guest: the public page
      # of a discoverable circle (AC-17.5). Anything else is an unknown circle (AC-4.6).
      def show
        if circle_policy.member?
          circle_policy.membership.update_column(:seen_at, Time.current) if circle_policy.membership.seen_at.nil?
          @policy = circle_policy
          render :show
        elsif circle_policy.show_public?
          render :public
        else
          raise ActiveRecord::RecordNotFound
        end
      end

      # AC-1.1 to AC-1.6, AC-17.1, AC-17.2, AC-17.7
      def create
        @circle = Circle.new(circle_params.merge(created_by: current_user))
        Circle.transaction do
          current_user.lock!
          raise ::Circles::Error.new(:circle_create_limit) if ::Circles::MyCircles.created_count(current_user) >= Circle::MAX_CREATED_PER_PARENT
          raise ::Circles::Error.new(:circle_member_limit) if ::Circles::Requests.circles_count(current_user) >= Circle::MAX_CIRCLES_PER_PARENT

          raise ActiveRecord::Rollback unless @circle.save

          now = Time.current
          @circle.memberships.create!(user: current_user, status: "active", role: "admin", creator: true, joined_at: now,
                                      admin_since: now, decided_at: now, seen_at: now)
          ::Circles::Audit.record!("circle_created", @circle, actor: current_user, subject: current_user)
        end
        return render_validation_errors(@circle) unless @circle.persisted?

        render_circle(status: :created)
      end

      # AC-6.1, AC-6.6, AC-17.1 to AC-17.3: members see the change at once, no notification.
      def update
        authorize @circle
        @circle.assign_attributes(circle_params)
        was_public = @circle.visibility_in_database == "public"
        return render_validation_errors(@circle) unless @circle.save

        if was_public != @circle.public?
          ::Circles::Audit.record!("circle_visibility_changed", @circle, actor: current_user, visibility: @circle.visibility)
        end
        render_circle
      end

      # AC-6.7
      def destroy
        authorize @circle
        ::Circles::Departure.new(@circle).delete_circle!(by: current_user)
        head :no_content
      rescue Pundit::NotAuthorizedError
        raise unless circle_policy.manage?

        render_error(:conflict, :circle_has_verified_members)
      end

      # AC-17.8 to AC-17.10
      def search
        result = ::Circles::Search.new(params, guest: current_user.nil?).call
        @circles = result.circles
        @pagination = { page: result.page, per_page: ::Circles::Search::PER_PAGE, next_page: result.next_page }
      rescue ::Events::Search::Invalid => e
        render_error(:unprocessable_content, :validation_failed, details: e.details)
      end

      # AC-5.5: the circle's audit entries, for its admins.
      def activity
        authorize @circle
        @entries = ::Circles::Audit.entries(@circle).to_a
        @people = User.where(id: @entries.flat_map { |entry| [ entry.actor_id, entry.subject_user_id ] }.compact).index_by(&:id)
      end

      private

      # AC-17.1: public by default. AC-17.2: creating and editing need a verified parent
      # (require_verified!, CirclePolicy#manage?), so nobody unverified makes a circle public.
      def circle_params
        permitted = params.require(:circle).permit(:name, :description, :area, :visibility)
        permitted[:visibility] = "public" if action_name == "create" && permitted[:visibility].blank?
        permitted
      end
    end
  end
end
