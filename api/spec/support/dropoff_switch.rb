# Web beta Q2: the drop-off switch is off by default. Tag an example or group with
# `dropoff: true` (or `dropoff: false`) to run it with the switch in that state.
RSpec.configure do |config|
  config.around(:each, :dropoff) do |example|
    previous = Rails.configuration.x.events.dropoff_enabled
    Rails.configuration.x.events.dropoff_enabled = example.metadata[:dropoff] == true
    example.run
  ensure
    Rails.configuration.x.events.dropoff_enabled = previous
  end
end
