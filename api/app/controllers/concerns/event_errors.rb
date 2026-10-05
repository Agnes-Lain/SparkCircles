# Maps refused event actions to the API error shape (docs/api/events.md section 1).
module EventErrors
  extend ActiveSupport::Concern

  included do
    rescue_from Events::Error do |error|
      if error.code == :not_enough_places
        render_error(:conflict, :not_enough_places, i18n: { count: error.places_left }, places_left: error.places_left)
      else
        render_error(error.status, error.code)
      end
    end
    rescue_from Events::Participations::Invalid do |error|
      render_validation_errors(error.record)
    end
  end
end
