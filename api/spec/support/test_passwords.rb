require "securerandom"

# Test passwords are generated at run time: no password literal lives in the repository
# (secret scanners flag them, and copied values end up reused). Each value is fixed for
# the whole test run, so a spec can set a password and log in with it later.
module TestPasswords
  def self.generate
    "#{SecureRandom.alphanumeric(16)}-#{SecureRandom.hex(4)}" # 25 characters, never in the common list
  end

  STRONG = generate
  NEW = generate
  ANOTHER = generate
  WRONG = generate

  COMMON_LIST = Rails.root.join("config/common_passwords.txt")
  FRENCH_BLOCK = "# French and other additions"

  # Entries of config/common_passwords.txt, read from the file so no breached password is
  # typed in a spec. `:seclists` = the SecLists block, `:french` = the French additions.
  def self.common_entries(block = :seclists)
    lines = COMMON_LIST.readlines(chomp: true)
    split = lines.index(FRENCH_BLOCK) or raise "#{FRENCH_BLOCK} not found in #{COMMON_LIST}"
    (block == :french ? lines[(split + 1)..] : lines[0...split]).reject { |line| line.blank? || line.start_with?("#") }
  end

  # The account's valid password (factory default).
  def strong_test_password = STRONG
  # A second valid password: the new one in reset and password-change specs.
  def new_test_password = NEW
  # A third valid password, different from the two above.
  def another_test_password = ANOTHER
  # A valid-looking password that is not the account's.
  def wrong_test_password = WRONG
  # Shorter than the 10-character minimum (AC-1.4).
  def short_test_password(length = 6) = SecureRandom.alphanumeric(length)
  # A breached password from the common list (AC-1.4).
  def common_test_password(block = :seclists) = TestPasswords.common_entries(block).first
end

RSpec.configure do |config|
  config.include TestPasswords
end
