# AC-2.4: accounts still unconfirmed 7 days after sign-up are deleted with all their data.
class PurgeUnconfirmedAccountsJob < ApplicationJob
  queue_as :default

  def perform
    User.unconfirmed_expired.find_each { |user| Accounts::Eraser.new(user).erase!(record_statistics: false) }
  end
end
