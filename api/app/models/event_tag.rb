# Tag rules (AC-3.8, AC-3.9): stored without "#", lower-case, duplicates ignored; letters
# (accents allowed), digits and hyphens only; never personal or contact data.
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

  module_function

  def normalize(tag) = tag.to_s.unicode_normalize(:nfc).strip.delete_prefix("#").downcase

  def normalize_list(tags) = Array(tags).map { |tag| normalize(tag) }.compact_blank.uniq

  # Returns the error key for one normalised tag, or nil when it's fine.
  def error_for(tag)
    return :contains_email if tag.match?(EMAIL)
    return :contains_link if tag.match?(LINK)
    return :contains_handle if tag.match?(HANDLE)
    return :contains_phone if tag.count("0-9") >= 6
    return :contains_address if tag.match?(STREET)
    return :invalid_characters unless tag.match?(FORMAT)
    return :too_short if tag.length < LENGTH.min
    return :too_long if tag.length > LENGTH.max

    :banned_word if banned?(tag)
  end

  def banned?(tag)
    words = banned_words
    words.include?(tag) || tag.split("-").any? { |part| words.include?(part) }
  end

  def banned_words
    @banned_words ||= Rails.application.config_for(:events)[:banned_tag_words].map { |word| normalize(word) }.to_set.freeze
  end
end
