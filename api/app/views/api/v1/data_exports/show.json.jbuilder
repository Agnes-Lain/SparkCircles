if @data_export
  json.data_export do
    json.status(@data_export.ready? && !@data_export.expires_at.future? ? "expired" : @data_export.status)
    json.requested_at @data_export.requested_at.utc.iso8601
    json.delivered_at @data_export.delivered_at&.utc&.iso8601
    json.expires_at @data_export.expires_at&.utc&.iso8601
  end
else
  json.data_export nil
end
