# A parent's spot in an event (AC-5.2): numbers only, at least one adult; one place per
# person attending. `places` is a generated column (adults + children). Joining and
# leaving go through Events::Participations, which keeps events.places_taken in step.
class EventParticipation < ApplicationRecord
  belongs_to :event, inverse_of: :participations
  belongs_to :user

  validates :adults, numericality: { only_integer: true }
  validates :children, numericality: { only_integer: true }
  validate :counts_in_range

  def requested_places = adults.to_i + children.to_i

  private

  def counts_in_range
    errors.add(:adults, :too_few) if adults.is_a?(Integer) && adults < 1
    errors.add(:children, :out_of_range) if children.is_a?(Integer) && children.negative?
    errors.add(:adults, :out_of_range) if requested_places > Event::PLACES.max
  end
end
