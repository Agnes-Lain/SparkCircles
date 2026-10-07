# Circles AC-6.4: a circle left without a verified member to run it closes once its 30 days'
# notice is over, unless someone took over as admin in the meantime.
class CloseCirclesJob < ApplicationJob
  queue_as :default

  def perform
    Circle.active.where(closes_on: ..Date.current).find_each do |circle|
      if circle.managed?
        circle.update_columns(closes_on: nil)
      else
        Circles::Departure.new(circle).close!
      end
    end
  end
end
