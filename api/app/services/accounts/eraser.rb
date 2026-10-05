module Accounts
  # Permanently erases an account and all its personal data (AC-2.4, AC-11.4 to AC-11.8).
  #
  # Hosted events and their participations, and the user's participations elsewhere, go
  # with the account (on delete cascade). Reports the user sent stay, unlinked and without
  # their free text (AC-11.6).
  #
  # Kept afterwards: a non-identifying statistics row for closed accounts (months only,
  # no ID, AC-11.6) and audit entries, which only hold the internal ID of a user that
  # no longer exists (AC-10.5). Database backups keep the data at most 7 days more
  # (setup decision D-16). No legal-retention data exists in v1 (AC-11.5 register is empty).
  class Eraser
    def initialize(user)
      @user = user
    end

    def erase!(record_statistics: true)
      User.transaction do
        record_statistic if record_statistics
        @user.verifications.each(&:purge_files!)
        @user.data_exports.each { |export| export.file.purge if export.file.attached? }
        # Reports stay for moderation, unlinked (reporter_id NULL, FK), without the free text.
        @user.event_reports.update_all(details: nil, updated_at: Time.current)
        @user.destroy!
      end
    end

    private

    def record_statistic
      ClosedAccountStatistic.create!(
        signup_month: @user.created_at.to_date.beginning_of_month,
        closure_month: (@user.closed_at || Time.current).to_date.beginning_of_month,
        was_verified: @user.verifications.any?(&:approved?)
      )
    end
  end
end
