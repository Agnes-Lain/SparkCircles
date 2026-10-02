module Api
  module V1
    # US-12: copy of my data (AC-12.1 to AC-12.3).
    class DataExportsController < BaseController
      def create
        @data_export = current_user.data_exports.pending.first ||
          current_user.data_exports.create!(requested_at: Time.current).tap { |export| BuildDataExportJob.perform_later(export) }
        render :show, status: :accepted
      end

      def show
        @data_export = current_user.data_exports.order(:requested_at).last
      end

      # AC-12.2: owner only, logged in, within 7 days.
      def download
        export = current_user.data_exports.order(:requested_at).last
        raise ActiveRecord::RecordNotFound unless export&.downloadable?

        response.headers["Cache-Control"] = "no-store"
        send_data export.read_encrypted(:file), filename: "sparkcircles-data.json", type: "application/json",
                                                disposition: "attachment"
      end
    end
  end
end
