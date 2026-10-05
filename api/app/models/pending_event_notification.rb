# A batch of event notification emails waiting for its window or for the end of quiet
# hours (docs/design/events-emails.md section 3). See Events::Notifications.
class PendingEventNotification < ApplicationRecord
  KINDS = %w[host_activity event_changed host_status].freeze

  belongs_to :event, optional: true
  belongs_to :host, class_name: "User", optional: true

  validates :kind, inclusion: { in: KINDS }
end
