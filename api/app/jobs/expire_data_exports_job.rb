# AC-12.2: data copies can be downloaded for 7 days, then the file is deleted.
class ExpireDataExportsJob < ApplicationJob
  queue_as :default

  def perform
    DataExport.to_expire.find_each(&:expire!)
  end
end
