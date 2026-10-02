# AC-7.10: ID images and selfies are erased 30 days after the decision.
class PurgeVerificationFilesJob < ApplicationJob
  queue_as :default

  def perform
    Verification.files_to_purge.find_each(&:purge_files!)
  end
end
