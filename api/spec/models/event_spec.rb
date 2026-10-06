require "rails_helper"

RSpec.describe Event do
  def tag_errors(*tags)
    event = build(:event, tags: tags)
    event.valid?
    event.errors.details[:tags].map { |detail| detail[:error] }
  end

  describe "tags" do
    it "AC-3.8 drops the #, lower-cases and ignores duplicates" do
      expect(build(:event, tags: [ "#Foot", "foot", " Goûter " ]).tags).to eq(%w[foot goûter])
    end

    it "AC-3.8 accepts letters with accents, digits and hyphens, 2 to 24 characters" do
      expect(tag_errors("éveil-musical", "6-10ans", "ab")).to be_empty
      expect(tag_errors("a")).to eq([ :too_short ])
      expect(tag_errors("a" * 25)).to eq([ :too_long ])
      expect(tag_errors("deux mots")).to eq([ :invalid_characters ])
    end

    it "AC-3.8 allows at most 5 tags" do
      expect(tag_errors("un", "deux", "trois", "quatre", "cinq", "six")).to eq([ :too_many ])
    end

    it "AC-3.9 refuses emails, phones, links, handles, street addresses and banned words" do
      expect(tag_errors("claire@mail.fr")).to eq([ :contains_email ])
      expect(tag_errors("06-12-34-56-78")).to eq([ :contains_phone ])
      expect(tag_errors("monsite.com")).to eq([ :contains_link ])
      expect(tag_errors("@claire")).to eq([ :contains_handle ])
      expect(tag_errors("12-rue-oberkampf")).to eq([ :contains_address ])
      expect(tag_errors("rue-de-la-paix")).to eq([ :contains_address ])
      expect(tag_errors("merde")).to eq([ :banned_word ])
      expect(tag_errors("soiree-sexy")).to eq([ :banned_word ])
      expect(tag_errors("culture", "rugby")).to be_empty
    end
  end

  describe "validations" do
    it "AC-1.2 places from 1 to 100" do
      expect(build(:event, places_total: 0)).not_to be_valid
      expect(build(:event, places_total: 100)).to be_valid
      expect(build(:event, places_total: 101)).not_to be_valid
    end

    it "AC-3.7 accepts only the 11 categories" do
      expect(Event::CATEGORIES.size).to eq(11)
      expect(build(:event, category: "cooking")).not_to be_valid
    end

    it "keeps the end after the start and within 24 hours" do
      start = 2.days.from_now
      expect(build(:event, starts_at: start, ends_at: start - 1.hour).errors_on_validate(:ends_at)).to eq([ :before_start ])
      expect(build(:event, starts_at: start, ends_at: start + 25.hours).errors_on_validate(:ends_at)).to eq([ :too_long_duration ])
    end

    it "BUG-8 a draft needs only its host; publishing needs every field" do
      draft = described_class.new(host: create(:user, :verified), title: "  ")
      expect(draft).to be_valid
      expect(draft.title).to be_nil
      expect(draft.publish!).to be(false)
      expect(draft.errors.attribute_names).to contain_exactly(:title, :category, :area, :starts_at, :ends_at, :exact_address, :places_total)
    end

    it "BUG-8 the database refuses a published event with missing fields" do
      draft = described_class.create!(host: create(:user, :verified))
      expect { draft.update_columns(status: "published") }.to raise_error(ActiveRecord::StatementInvalid, /required_unless_draft|source_fields/)
    end

    it "AC-1.6 checks a draft's start only when it is published" do
      draft = build(:event, :draft, starts_at: 1.hour.ago, ends_at: 1.hour.from_now)
      expect(draft).to be_valid
      expect(draft.publish!).to be(false)
      expect(draft.errors.details[:starts_at]).to eq([ { error: :in_past } ])
    end

    it "AC-5.8 the database refuses more places taken than the total" do
      event = create(:event, places_total: 2)
      expect { event.update_columns(places_taken: 3) }.to raise_error(ActiveRecord::StatementInvalid, /places_taken_check/)
    end
  end

  it "AC-1.3, AC-6.1 encrypts the exact address" do
    event = create(:event)
    raw = Event.connection.select_value("SELECT exact_address FROM events WHERE id = #{Event.connection.quote(event.id)}")
    expect(raw).not_to include("Oberkampf")
  end
end

class Event
  def errors_on_validate(attribute)
    valid?
    errors.details[attribute].map { |detail| detail[:error] }
  end
end
