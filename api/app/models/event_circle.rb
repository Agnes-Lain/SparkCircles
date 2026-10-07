# A circle a circle-only event is visible to (spec circles US-16, events US-14).
class EventCircle < ApplicationRecord
  self.primary_key = %i[event_id circle_id]

  belongs_to :event
  belongs_to :circle
end
