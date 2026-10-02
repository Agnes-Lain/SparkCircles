require "rails_helper"

# Spec US-10: sensitive fields are encrypted by the app, never readable in plain text.
RSpec.describe "Active Record Encryption configuration" do
  it "has its keys configured" do
    config = ActiveRecord::Encryption.config

    expect(config.primary_key).to be_present
    expect(config.deterministic_key).to be_present
    expect(config.key_derivation_salt).to be_present
  end

  it "refuses to read unencrypted values from encrypted columns" do
    expect(ActiveRecord::Encryption.config.support_unencrypted_data).to be(false)
  end
end
