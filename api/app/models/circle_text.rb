# Content checks for what a circle shows to others (spec circles AC-1.3, AC-17.7): no e-mail
# address, phone number or link in the name or description, and, for a public circle, none
# of the banned words used for event tags. The checks read the same "skeleton" as tags
# (EventTag): accents dropped, look-alike Cyrillic and Greek letters mapped to Latin.
module CircleText
  EMAIL = /[^@\s]+@[^@\s]+\.[^@\s]{2,}/
  LINK = %r{https?:|www\.|://|\b[a-z0-9-]+\.(com|fr|net|org|io|eu|be|ch|co|me|ly|gg|app|link)\b}i
  # Six digits or more in a row, spaces, dots and dashes allowed between them.
  PHONE = /(?:\+|\b)\d(?:[\s.\-]?\d){5,}/

  module_function

  # The error key for one text, or nil when it's fine.
  def error_for(text, banned_words: false)
    return nil if text.blank?

    plain = skeleton(text)
    return :contains_email if plain.match?(EMAIL)
    return :contains_link if plain.match?(LINK)
    return :contains_phone if plain.match?(PHONE)

    :banned_word if banned_words && banned?(plain)
  end

  def skeleton(text)
    EventTag.fold_digits(text.to_s.unicode_normalize(:nfkc)).downcase
            .unicode_normalize(:nfd).gsub(/\p{Mn}/, "").tr(EventTag::CONFUSABLES_FROM, EventTag::CONFUSABLES_TO)
  end

  def banned?(plain)
    words = EventTag.banned_words
    plain.scan(/[\p{L}\p{N}]+/).any? { |word| words.include?(word) }
  end
end
