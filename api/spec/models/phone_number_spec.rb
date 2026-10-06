require "rails_helper"

RSpec.describe PhoneNumber do
  describe "AC-17.11 accepted numbers, normalized to E.164" do
    {
      "06 12 34 56 78" => "+33612345678", "06.12.34.56.78" => "+33612345678", "0612345678" => "+33612345678",
      "+33 6 12 34 56 78" => "+33612345678", "+33 (0)6 12 34 56 78" => "+33612345678", "0033612345678" => "+33612345678",
      "01 23 45 67 89" => "+33123456789", "+49 30 1234567" => "+49301234567", "+32 470 12 34 56" => "+32470123456",
      "+351 912 345 678" => "+351912345678"
    }.each do |raw, normalized|
      it("accepts #{raw}") { expect(described_class.normalize(raw)).to eq(normalized) }
    end
  end

  describe "AC-17.11 refused numbers" do
    [ "12345", "06 12 34 56", "00 12 34 56 78", "+1 415 555 0100", "+44 20 7946 0958", "+33 6 12 34 56", "+41 44 668 18 00",
      "phone", "", nil, [ "0612345678" ] ].each do |raw|
      it("refuses #{raw.inspect}") { expect(described_class.normalize(raw)).to be_nil }
    end
  end
end
