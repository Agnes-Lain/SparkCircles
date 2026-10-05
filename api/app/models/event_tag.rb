# Tag rules (AC-3.8, AC-3.9): stored without "#", lower-case, duplicates ignored; letters
# (accents allowed), digits and hyphens only; never personal or contact data.
#
# Tags are normalised with NFKC (fullwidth and other compatibility forms become plain
# characters) and every decimal digit is folded to ASCII (Arabic-Indic "٠٦" becomes "06").
# The contact-data and banned-word checks run on a "skeleton" that also strips accents and
# maps Cyrillic and Greek look-alikes to Latin letters, so "sеx" (Cyrillic е) is caught.
module EventTag
  MAX_PER_EVENT = 5
  LENGTH = 2..24
  FORMAT = /\A[\p{L}\p{N}-]+\z/
  EMAIL = /[^@\s]+@[^@\s]+\.[^@\s]+/
  LINK = %r{https?:|www\.|://|\.(com|fr|net|org|io|eu|be|ch|co|me|ly|gg)\b}i
  HANDLE = /@/
  STREET_WORDS = %w[rue avenue av bd boulevard place impasse allee allée chemin quai cours passage square villa
                    street st road rd lane].freeze
  STREET = /(\A|-)\d+(-?(bis|ter))?-(#{STREET_WORDS.join('|')})(-|\z)|\A(rue|avenue|boulevard|impasse|allee|allée|quai|chemin)-/i
  # Lower-case Cyrillic and Greek letters that look like Latin ones (Unicode confusables).
  CONFUSABLES_FROM = "аеёһіїјкԁоӏрԛсѕтуԝхɑɡıαβεικνορτυχω"
  CONFUSABLES_TO   = "aeehiijkdolpqcstywxagiabeikvoptuxw"

  module_function

  def normalize(tag) = fold_digits(tag.to_s.unicode_normalize(:nfkc)).strip.delete_prefix("#").downcase

  def normalize_list(tags) = Array(tags).map { |tag| normalize(tag) }.compact_blank.uniq

  # Every decimal digit (any script) becomes its ASCII digit. Unicode lays decimal digits out
  # in runs of ten starting at zero, so the value is the offset within the run.
  def fold_digits(text)
    text.gsub(/[^0-9]/) do |char|
      next char unless char.match?(/\p{Nd}/)

      start = char.ord
      start -= 1 while (start - 1).chr(Encoding::UTF_8).match?(/\p{Nd}/)
      ((char.ord - start) % 10).to_s
    end
  end

  # What the tag looks like to a reader: no accents, look-alike letters mapped to Latin.
  def skeleton(tag)
    normalize(tag).unicode_normalize(:nfd).gsub(/\p{Mn}/, "").tr(CONFUSABLES_FROM, CONFUSABLES_TO)
  end

  # Returns the error key for one normalised tag, or nil when it's fine.
  def error_for(tag)
    plain = skeleton(tag)
    return :contains_email if plain.match?(EMAIL)
    return :contains_link if plain.match?(LINK)
    return :contains_handle if plain.match?(HANDLE)
    return :contains_phone if plain.count("0-9") >= 6
    return :contains_address if plain.match?(STREET)
    return :invalid_characters unless tag.match?(FORMAT)
    return :too_short if tag.length < LENGTH.min
    return :too_long if tag.length > LENGTH.max

    :banned_word if banned?(plain)
  end

  def banned?(plain)
    words = banned_words
    words.include?(plain) || plain.split("-").any? { |part| words.include?(part) }
  end

  def banned_words
    @banned_words ||= Rails.application.config_for(:events)[:banned_tag_words].map { |word| skeleton(word) }.to_set.freeze
  end
end
