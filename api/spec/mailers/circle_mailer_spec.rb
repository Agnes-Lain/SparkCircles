require "rails_helper"

RSpec.describe CircleMailer do
  let(:admin) { create(:user, :verified, locale: "fr") }
  let(:circle) { create(:circle, created_by: admin) }

  it "AC-2.4 tells an admin who asked (first name and initial), with a link to the circle" do
    mail = described_class.request_received(circle, admin, create(:user, first_name: "Inès", last_name: "Bah"))
    expect(mail.subject).to eq("Nouvelle demande pour « #{circle.name} »")
    expect(mail.text_part.decoded).to include("Inès B.", "circles/#{circle.id}")
    expect(mail.text_part.decoded).not_to include("Bah")
  end

  it "AC-2.5 the decline is neutral: no reason, no admin name" do
    mail = described_class.request_declined(circle, create(:user, first_name: "Léa", locale: "en"))
    expect(mail.text_part.decoded).to include("was not accepted")
    expect(mail.text_part.decoded).not_to include(admin.first_name)
  end

  it "AC-16.5 says why the outing is lost, with no other reason" do
    event = create(:event, title: "Goûter au parc")
    left = described_class.event_access_lost(event, create(:user, locale: "fr"), :left)
    expect(left.text_part.decoded).to include("Tu ne peux plus participer à « Goûter au parc » : tu as quitté le cercle.")
    expect(left.text_part.decoded).not_to include(event.exact_address)
  end
end
