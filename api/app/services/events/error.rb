module Events
  # A refused event action, mapped by the API to { error: { code, message } }.
  class Error < StandardError
    attr_reader :code, :status, :places_left

    def initialize(code, status: :conflict, places_left: nil)
      @code = code
      @status = status
      @places_left = places_left
      super(code.to_s)
    end
  end
end
