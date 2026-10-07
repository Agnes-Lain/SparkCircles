module Circles
  # A refused circle action, mapped by the API to { error: { code, message } }.
  class Error < StandardError
    attr_reader :code, :status

    def initialize(code, status: :conflict)
      @code = code
      @status = status
      super(code.to_s)
    end
  end
end
