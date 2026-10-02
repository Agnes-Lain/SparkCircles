# AC-1.4: at least 10 characters and not a commonly breached password.
class PasswordPolicyValidator < ActiveModel::EachValidator
  MIN_LENGTH = 10
  MIN_DISTINCT_CHARACTERS = 4

  def self.common_passwords
    @common_passwords ||= Rails.root.join("config/common_passwords.txt").readlines(chomp: true)
      .reject { |line| line.blank? || line.start_with?("#") }.map(&:downcase).to_set
  end

  def validate_each(record, attribute, value)
    if value.length < MIN_LENGTH
      record.errors.add(attribute, :too_short, count: MIN_LENGTH)
    elsif self.class.common_passwords.include?(value.downcase) || value.chars.uniq.size < MIN_DISTINCT_CHARACTERS
      record.errors.add(attribute, :too_common)
    end
  end
end
