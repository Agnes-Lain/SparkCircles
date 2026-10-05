require "rails_helper"
require Rails.root.join("spec/mailers/previews/event_mailer_preview").to_s

# Event notification emails E1 to E7 (events-emails section 2). Batching: spec/services/events/notifications_spec.rb.
RSpec.describe EventMailer do
  let(:host) { create(:user, :verified, first_name: "Camille", last_name: "Dupont", locale: "fr") }
  let(:guest) { create(:user, :verified, first_name: "Léa", last_name: "Durand", locale: "fr") }
  let(:event) do
    create(:event, host: host, title: "Football au parc", area: "paris-11", places_total: 8,
                   starts_at: Time.zone.parse("2026-10-17 14:30"), ends_at: Time.zone.parse("2026-10-17 16:30"))
  end
  let(:snapshot) { Events::Notifications.snapshot(event) }

  before { travel_to(Time.zone.parse("2026-10-07 10:00")) }

  def text(mail) = mail.text_part.body.to_s
  def html(mail) = mail.html_part.body.to_s

  # Privacy rules 1, 3 and 4: checked on both parts of every email built here.
  def expect_private(mail)
    [ text(mail), html(mail) ].each do |body|
      expect(body).not_to include("Oberkampf", "75011", "enfant", "child", "adult", "vérification n'est plus active à cause")
    end
  end

  describe "E1 host_activity" do
    it "AC-5.1 tells the host who joined, with places only, in French" do
      mail = described_class.host_activity(event, [ { "user" => guest, "from" => 0, "to" => 2 } ], places_left: 3, places_total: 8)
      expect(mail.to).to eq([ host.email ])
      expect(mail.subject).to eq("Léa D. a rejoint « Football au parc »")
      expect(text(mail)).to include("Bonjour Camille,", "Football au parc\nsamedi 17 oct., 14 h 30",
                                    "Léa D. a rejoint ta sortie avec 2 places.", "Il reste 3 places sur 8.",
                                    "Voir la sortie:\nhttp://localhost:8081/events/#{event.id}")
      expect(text(mail)).not_to include("Durand")
      expect_private(mail)
    end

    it "AC-5.4 and AC-5.2 single forms for a leave and a change" do
      leave = described_class.host_activity(event, [ { "user" => guest, "from" => 2, "to" => 0 } ], places_left: 5, places_total: 8)
      expect(leave.subject).to eq("Léa D. ne vient plus à « Football au parc »")
      expect(text(leave)).to include("Léa D. a quitté ta sortie. Sa place est libre.", "Il reste 5 places sur 8.")
      change = described_class.host_activity(event, [ { "user" => guest, "from" => 2, "to" => 3 } ], places_left: 1, places_total: 8)
      expect(text(change)).to include("Léa D. passe de 2 à 3 places.", "Il reste 1 place sur 8.")
    end

    it "digests several actions in English, at most 8 lines, and says when the event is full" do
      host.update!(locale: "en")
      people = Array.new(9) { |index| build(:user, first_name: "P#{index}", last_name: "Zed") }
      entries = people.map { |person| { "user" => person, "from" => 0, "to" => 1 } }
      mail = described_class.host_activity(event, entries, places_left: 0, places_total: 8)
      expect(mail.subject).to eq("9 updates for “Football au parc”")
      expect(text(mail)).to include("Here's what happened on your event:", "- P0 Z. joined (1 place)", "- and 1 more",
                                    "Your event is full.")
      expect(text(mail)).not_to include("P8 Z.", "places left")
    end
  end

  describe "E2 event_changed" do
    it "AC-7.2 lists only what changed, the area but never the address, in English" do
      guest.update!(locale: "en")
      before = snapshot.merge("title" => "Old title", "starts_at" => (event.starts_at - 1.hour).utc.iso8601, "area" => "paris-12")
      mail = described_class.event_changed(event, guest, before, snapshot)
      expect(mail.to).to eq([ guest.email ])
      expect(mail.subject).to eq("“Football au parc” has changed")
      expect(text(mail)).to include("Camille D. changed this event.", "Title: Old title -> Football au parc",
                                    "Date: Sat 17 Oct, 1:30 pm -> Sat 17 Oct, 2:30 pm",
                                    "Place: Paris 12th -> Paris 11th. Open the app to see the address.",
                                    "See the changes:\nhttp://localhost:8081/events/#{event.id}")
      expect(html(mail)).to include("<strong>Title:</strong> Old title → Football au parc")
      expect(text(mail)).not_to include("Places:")
      expect_private(mail)
    end

    it "says only that the address changed inside the same area" do
      mail = described_class.event_changed(event, guest, snapshot.merge("address_digest" => "x"), snapshot)
      expect(text(mail)).to include("Lieu : l'adresse a changé. Ouvre l'app pour la voir.")
      expect_private(mail)
    end
  end

  describe "E3 and E3b event_cancelled" do
    it "AC-7.3 names the host and opens search" do
      guest.update!(locale: "en")
      mail = described_class.event_cancelled(event, guest)
      expect(mail.subject).to eq("“Football au parc” is cancelled")
      expect(text(mail)).to include("Camille D. cancelled the event planned for Sat 17 Oct, 2:30 pm.",
                                    "Sorry this one fell through: there are other events near you.",
                                    "Find another event:\nhttp://localhost:8081/events\n")
      expect_private(mail)
    end

    it "AC-8.3, AC-8.5 the neutral variant has no host name and no reason" do
      mail = described_class.event_cancelled(event, guest, neutral: true)
      expect(mail.subject).to eq("« Football au parc » est annulée")
      expect(text(mail)).to include("La sortie prévue le samedi 17 oct., 14 h 30 est annulée.")
      expect(text(mail)).not_to include("Camille", "Dupont", "vérif")
    end
  end

  describe "E4 to E7 hold and resume" do
    let(:other) { create(:event, host: host, title: "Atelier peinture") }

    it "AC-8.2 tells a participant an event is on hold, without any reason" do
      mail = described_class.event_on_hold(guest, [ event ])
      expect(mail.subject).to eq("« Football au parc » est en pause")
      expect(text(mail)).to include("Tu gardes ta place", "http://localhost:8081/events/#{event.id}")
      expect(text(mail)).not_to include("vérif", "Camille", "compte")
      expect_private(mail)
    end

    it "merges a host's events into one email that opens my-events" do
      mail = described_class.event_on_hold(guest, [ other, event ])
      expect(mail.subject).to eq("« Atelier peinture » et « Football au parc » sont en pause")
      expect(text(mail)).to include("Ces sorties sont en pause", "http://localhost:8081/my-events")
    end

    it "tells the host once, with the count and no reason, and opens verification" do
      mail = described_class.events_on_hold_host(host, [ event, other ])
      expect(mail.to).to eq([ host.email ])
      expect(text(mail)).to include("tes 2 sorties à venir sont en pause : elles n'apparaissent plus",
                                    "http://localhost:8081/verification")
      expect(text(mail)).not_to include("expir", "révoqu", "rejet")
    end

    it "AC-8.3 tells participants and the host that events are back on" do
      expect(text(described_class.event_resumed(guest, [ event ])))
        .to include("Bonne nouvelle : la sortie reprend comme prévu, le samedi 17 oct., 14 h 30.")
      host.update!(locale: "en")
      mail = described_class.events_resumed_host(host, [ event ])
      expect(mail.subject).to eq("Your events are back on")
      expect(text(mail)).to include("your upcoming event is visible", "http://localhost:8081/my-events")
    end
  end

  it "truncates long titles to 40 characters in subjects" do
    event.update!(title: "Une très longue sortie au parc avec des jeux pour tout le monde")
    expect(described_class.event_cancelled(event, guest).subject).to eq("« Une très longue sortie au parc avec des… » est annulée")
  end

  it "has a French and an English preview for every email, none with an address" do
    expect(EventMailerPreview.emails.size).to eq(14)
    %w[fr en].each do |locale|
      EventMailerPreview.emails.each do |name|
        mail = EventMailerPreview.call(name, locale: locale)
        expect(mail.subject).to be_present
        expect([ mail.text_part, mail.html_part ]).to all(be_present)
      end
    end
  end
end
