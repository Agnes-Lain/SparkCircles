module Api
  module V1
    # Categories, areas, age bands, report reasons and limits for forms and filters (AC-3.7).
    class EventOptionsController < BaseController
      include GuestAccess

      allow_guests :show, limits: [ { to: 60, within: 1.minute, per: :device }, { to: 120, within: 1.minute, per: :ip } ]

      def show; end
    end
  end
end
