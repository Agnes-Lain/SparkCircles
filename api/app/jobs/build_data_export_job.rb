# AC-12.1: builds the user's data copy (JSON), stores it encrypted, emails the user.
class BuildDataExportJob < ApplicationJob
  queue_as :default

  def perform(data_export)
    return unless data_export.pending?

    json = Accounts::DataExportBuilder.new(data_export.user).to_json
    data_export.attach_encrypted(:file, json, filename: "data-export")
    data_export.update!(status: "ready", delivered_at: Time.current, expires_at: DataExport::DOWNLOAD_WINDOW.from_now)
    AccountMailer.data_export_ready(data_export.user, data_export).deliver_later
  end
end
