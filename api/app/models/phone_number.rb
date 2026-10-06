# Phone numbers for drop-off events (spec events AC-17.11): French numbers in the national
# 10-digit format or +33, and other EU numbers in international format, normalized to
# E.164 ("+33612345678"). Never checked by calling or texting.
module PhoneNumber
  # EU member states' country codes (+33 France is checked on its own, 9 digits after it).
  EU_CODES = %w[30 31 32 34 36 39 40 43 45 46 48 49 351 352 353 356 357 358 359 370 371 372 385 386 420 421].freeze
  SEPARATORS = /[\s.\-() ]/

  module_function

  # The E.164 form, or nil when the number is not accepted.
  def normalize(raw)
    return nil unless raw.is_a?(String)

    compact = raw.gsub(SEPARATORS, "")
    compact = "+#{compact.delete_prefix('00')}" if compact.start_with?("00")
    case compact
    when /\A0([1-9]\d{8})\z/ then "+33#{Regexp.last_match(1)}"
    when /\A\+33(?:0)?([1-9]\d{8})\z/ then "+33#{Regexp.last_match(1)}"
    when /\A\+(\d{8,15})\z/ then eu_international(Regexp.last_match(1))
    end
  end

  def valid?(raw) = normalize(raw).present?

  def eu_international(digits)
    return nil if digits.start_with?("33")

    code = EU_CODES.find { |prefix| digits.start_with?(prefix) }
    code && digits.length - code.length >= 6 ? "+#{digits}" : nil
  end
end
