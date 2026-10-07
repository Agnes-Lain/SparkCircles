module Api
  module V1
    module Circles
      # Report a circle or one of its members (AC-7.1, AC-7.2, AC-7.4, AC-17.7). Only
      # SparkCircles admins see reports; a repeat report gets the same thanks.
      class ReportsController < BaseController
        include CircleAccess

        rate_limit to: 10, within: 1.hour, by: -> { current_user.id }, name: "circle-report", store: GuestAccess::STORE,
                   with: :rate_limited

        before_action :find_circle

        def create
          authorize @circle, :report?
          unless params[:details].nil? || params[:details].is_a?(String)
            return render_error(:unprocessable_content, :validation_failed, details: { details: [ "invalid" ] })
          end

          report = @circle.reports.build(reporter: current_user, reason: params[:reason].is_a?(String) ? params[:reason] : nil,
                                         details: params[:details], reported_user: reported_user)
          return render_validation_errors(report) unless report.save

          render json: { report: { id: report.id, created_at: report.created_at.utc.iso8601 } }, status: :created
        end

        private

        # Members only report members of their own circle.
        def reported_user
          return nil if params[:member_id].blank?
          raise ActiveRecord::RecordNotFound unless circle_policy.member?

          @circle.memberships.active.find(params[:member_id]).user
        end
      end
    end
  end
end
