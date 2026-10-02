# AC-11.4: closed accounts are erased at the end of the 30-day grace period.
class EraseClosedAccountsJob < ApplicationJob
  queue_as :default

  def perform
    User.due_for_erasure.find_each { |user| Accounts::Eraser.new(user).erase! }
  end
end
