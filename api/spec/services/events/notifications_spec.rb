require "rails_helper"

# Batching and quiet hours of the event emails (events-emails section 3), through the real
# hooks: participations, host edits and cancels, verification changes, closure.
RSpec.describe Events::Notifications do
  let(:host) { create(:user, :verified, first_name: "Camille", last_name: "Dupont", locale: "fr") }
  let(:lea) { create(:user, :verified, first_name: "Léa", last_name: "Durand", locale: "fr") }
  let(:karim) { create(:user, :verified, first_name: "Karim", last_name: "Rahmani", locale: "en") }
  let(:event) { create(:event, host: host, title: "Football au parc", starts_at: 3.days.from_now.change(hour: 14)) }

  # Wednesday 7 October 2026, Paris time.
  def paris(time) = Time.zone.parse("2026-10-07 #{time}")

  before { travel_to(paris("10:00")) }

  after { ActionMailer::Base.deliveries.clear }

  # Moves the clock and runs every job due by then (batches, then the mail jobs they enqueue).
  def run_until(time)
    travel_to(time)
    5.times { perform_enqueued_jobs(at: Time.current) }
  end

  def mails = ActionMailer::Base.deliveries
  def mails_to(user) = mails.select { |mail| mail.to == [ user.email ] }
  def all_bodies = mails.flat_map { |mail| [ mail.text_part.body.to_s, mail.html_part.body.to_s ] }.join

  def join(user, adults: 1, children: 1) = Events::Participations.new(event.reload, user).join!(adults: adults, children: children)
  def leave(user) = Events::Participations.new(event.reload, user).leave!
  def change(user, adults:, children:) = Events::Participations.new(event.reload, user).change!(adults: adults, children: children)

  def edit(attributes)
    before = described_class.snapshot(event.reload)
    event.update!(attributes)
    described_class.event_edited(event, before)
  end

  describe "E1 host digest (15 minutes)" do
    it "AC-5.1 sends nothing before 15 minutes, then one single email" do
      join(lea, adults: 1, children: 2)
      run_until(paris("10:14"))
      expect(mails).to be_empty
      run_until(paris("10:15"))
      expect(mails_to(host).map(&:subject)).to eq([ "Léa D. a rejoint « Football au parc »" ])
      expect(all_bodies).to include("avec 3 places")
      expect(all_bodies).not_to include("Oberkampf", "enfant")
    end

    it "groups the window into one digest with net results, and waits an hour before the next digest" do
      join(lea)
      travel_to(paris("10:05"))
      join(karim)
      change(lea, adults: 2, children: 1)
      run_until(paris("10:15"))
      expect(mails_to(host).sole.subject).to eq("2 nouveautés pour « Football au parc »")
      expect(all_bodies).to include("Léa D. a rejoint (3 places)", "Karim R. a rejoint (2 places)")

      mails.clear
      travel_to(paris("10:20"))
      leave(karim)
      run_until(paris("10:35"))
      expect(mails).to be_empty
      run_until(paris("11:15"))
      expect(mails_to(host).sole.subject).to eq("Karim R. ne vient plus à « Football au parc »")
    end

    it "sends nothing when a parent joins and leaves inside the window" do
      join(lea)
      travel_to(paris("10:03"))
      leave(lea)
      run_until(paris("10:30"))
      expect(mails).to be_empty
    end

    it "AC-8.6 a removal by the system shows as an anonymous \"left\", without name or reason" do
      join(lea)
      run_until(paris("10:15"))
      mails.clear
      Events::Participations.remove_from_upcoming!(lea)
      expect(PendingEventNotification.find_by(kind: "host_activity", event: event).payload.to_json).not_to include(lea.id)
      run_until(paris("11:15"))
      mail = mails_to(host).sole
      expect(mail.subject).to eq("1 nouveauté pour « Football au parc »")
      expect(mail.text_part.body.to_s).to include("1 personne s'est désinscrite", "Il reste 10 places sur 10.")
      expect(all_bodies).not_to include("Léa", "vérif", "ferm")
    end

    it "AC-8.5 lists a closure next to named actions in the digest, in English too" do
      host.update!(locale: "en")
      join(lea)
      run_until(paris("10:15"))
      mails.clear
      travel_to(paris("11:20"))
      join(karim)
      Accounts::Closure.new(lea).close!
      run_until(paris("11:35"))
      body = mails_to(host).sole.text_part.body.to_s
      expect(mails_to(host).sole.subject).to eq("2 updates for “Football au parc”")
      expect(body).to include("Karim R. joined (2 places)", "1 person left")
      expect(body).not_to include("Léa")
    end

    it "drops a parent who joined then was removed by the system inside the window" do
      join(lea)
      travel_to(paris("10:05"))
      Events::Participations.remove_from_upcoming!(lea)
      run_until(paris("10:30"))
      expect(mails).to be_empty
    end

    it "BUG-11 erasure strips the person's id from a pending digest; the leave stays anonymous" do
      join(lea)
      run_until(paris("10:15"))
      mails.clear
      travel_to(paris("11:20"))
      leave(lea)
      Accounts::Closure.new(lea).close!
      perform_enqueued_jobs(at: Time.current) # the account emails, before the person is gone
      mails.clear
      Accounts::Eraser.new(lea.reload).erase!
      expect(PendingEventNotification.where(kind: "host_activity").map { |batch| batch.payload.to_json }.join).not_to include(lea.id)
      run_until(paris("11:35"))
      expect(mails_to(host).sole.text_part.body.to_s).to include("1 personne s'est désinscrite")
      expect(all_bodies).not_to include("Léa")
    end
  end

  describe "E2 edits (10 minutes, net difference)" do
    before do
      join(lea)
      join(karim)
      run_until(paris("10:15"))
      mails.clear
    end

    it "AC-7.2 sends one email per participant, never to the host, with the net changes" do
      travel_to(paris("10:20"))
      edit(title: "Foot au parc")
      travel_to(paris("10:25"))
      edit(title: "Foot géant", area: "paris-12", exact_address: "3 rue de Lyon, 75012 Paris")
      run_until(paris("10:29"))
      expect(mails).to be_empty
      run_until(paris("10:30"))
      expect(mails.map(&:to).flatten).to contain_exactly(lea.email, karim.email)
      expect(mails_to(lea).sole.text_part.body.to_s)
        .to include("Titre : Football au parc -> Foot géant", "Lieu : Paris 11e -> Paris 12e. Ouvre l'app pour voir l'adresse.")
      expect(mails_to(karim).sole.subject).to eq("“Foot géant” has changed")
      expect(all_bodies).not_to include("rue de Lyon", "75012", "Oberkampf")
    end

    it "BUG-12 shows only the end time when only the end time changed" do
      travel_to(paris("10:20"))
      edit(ends_at: event.starts_at + 3.hours)
      run_until(paris("10:30"))
      expect(mails_to(lea).sole.text_part.body.to_s).to include("Heure de fin : 16 h -> 17 h")
      expect(mails_to(lea).sole.text_part.body.to_s).not_to include("Date :")
      expect(mails_to(karim).sole.text_part.body.to_s).to include("End time: 4 pm -> 5 pm")
    end

    it "sends nothing when the edits are reverted, for a tags-only edit or for a places-only edit" do
      edit(title: "Autre")
      edit(title: "Football au parc")
      edit(tags: %w[foot])
      edit(places_total: 20)
      run_until(paris("11:00"))
      expect(mails).to be_empty
    end
  end

  describe "E3 and E3b cancellations (never delayed)" do
    before do
      join(lea)
      edit(title: "Foot")
    end

    it "AC-7.3 emails participants at once, at night too, and drops the pending batches" do
      travel_to(paris("23:30"))
      event.cancel!
      described_class.event_cancelled(event, neutral: false)
      perform_enqueued_jobs(at: Time.current)
      expect(mails_to(lea).sole.text_part.body.to_s).to include("Camille D. a annulé la sortie")
      expect(PendingEventNotification.where(event: event)).to be_empty
      run_until(paris("10:00") + 1.day)
      expect(mails.size).to eq(1)
    end

    it "AC-8.5 a host's closure sends the neutral email (no host name)" do
      Accounts::Closure.new(host).close!
      perform_enqueued_jobs(at: Time.current)
      body = mails_to(lea).sole.text_part.body.to_s
      expect(body).to include("est annulée")
      expect(body).not_to include("Camille")
    end
  end

  describe "E4 to E7 hold and resume" do
    let!(:second) { create(:event, host: host, title: "Atelier peinture", starts_at: 5.days.from_now) }

    before do
      join(lea)
      Events::Participations.new(second, lea).join!(adults: 1, children: 0)
      run_until(paris("10:15"))
      mails.clear
    end

    it "AC-8.2 one email per participant for all the host's events, one to the host, no reason" do
      host.update!(verification_status: "expired")
      run_until(paris("10:17"))
      expect(mails_to(lea).sole.subject).to eq("« Football au parc » et « Atelier peinture » sont en pause")
      expect(mails_to(host).sole.subject).to eq("Tes sorties à venir sont en pause")
      expect(mails_to(lea).sole.text_part.body.to_s).not_to include("vérif", "expir", "Camille")
    end

    it "AC-8.3 a hold undone before sending sends nothing" do
      host.update!(verification_status: "expired")
      host.update!(verification_status: "verified")
      run_until(paris("10:30"))
      expect(mails).to be_empty
    end

    it "AC-8.3 a resume sends E6 and E7" do
      host.update!(verification_status: "expired")
      run_until(paris("10:17"))
      mails.clear
      host.update!(verification_status: "verified")
      run_until(paris("10:19"))
      expect(mails_to(lea).sole.subject).to eq("« Football au parc » et « Atelier peinture » reprennent")
      expect(mails_to(host).sole.subject).to eq("Tes sorties reprennent")
    end

    it "a back-office suspension sends E4 to participants only, no reason, after the 1-minute window" do
      Admin::EventActions.new(admin: create(:user, :admin)).suspend!(event)
      run_until(paris("10:15") + 30.seconds)
      expect(mails).to be_empty
      run_until(paris("10:17"))
      expect(mails_to(lea).sole.subject).to eq("« Football au parc » est en pause")
      expect(mails_to(host)).to be_empty
      expect(all_bodies).not_to include("signal", "admin", "Camille")
    end

    it "a back-office suspension merges with a verification hold; only the host-verification events reach the host" do
      Admin::EventActions.new(admin: create(:user, :admin)).suspend!(event)
      host.update!(verification_status: "expired")
      run_until(paris("10:17"))
      expect(mails_to(lea).sole.subject).to eq("« Football au parc » et « Atelier peinture » sont en pause")
      expect(mails_to(host).sole.text_part.body.to_s).to include("ta sortie à venir est en pause")
    end

    it "a back-office suspension of an event already on hold sends nothing more" do
      host.update!(verification_status: "expired")
      run_until(paris("10:17"))
      mails.clear
      Admin::EventActions.new(admin: create(:user, :admin)).suspend!(event.reload)
      run_until(paris("10:30"))
      expect(mails).to be_empty
    end

    it "AC-8.3 an event that starts while on hold is cancelled with the neutral email" do
      host.update!(verification_status: "expired")
      run_until(paris("10:17"))
      mails.clear
      travel_to(event.starts_at + 1.minute)
      EventStatusJob.perform_now
      perform_enqueued_jobs(at: Time.current)
      expect(mails_to(lea).map(&:subject)).to eq([ "« Football au parc » est annulée" ])
    end
  end

  describe "quiet hours 22:00 to 08:00 Paris" do
    it "holds the host digest until 08:00" do
      travel_to(paris("21:50"))
      join(lea)
      run_until(paris("22:05"))
      expect(mails).to be_empty
      run_until(paris("07:59") + 1.day)
      expect(mails).to be_empty
      run_until(paris("08:00") + 1.day)
      expect(mails_to(host).size).to eq(1)
    end

    it "sends at night anything about an event starting before 08:00" do
      early = create(:event, host: host, title: "Lever de soleil", starts_at: paris("07:00") + 1.day)
      travel_to(paris("23:00"))
      Events::Participations.new(early, lea).join!(adults: 1, children: 0)
      run_until(paris("23:15"))
      expect(mails_to(host).size).to eq(1)
    end

    it "sends an edit at night only when the event starts within 24 hours" do
      soon = create(:event, host: host, title: "Demain", starts_at: paris("18:00") + 1.day)
      Events::Participations.new(soon, lea).join!(adults: 1, children: 0)
      join(lea)
      run_until(paris("10:15"))
      mails.clear

      travel_to(paris("23:00"))
      [ soon, event ].each do |target|
        before = described_class.snapshot(target)
        target.update!(title: "#{target.title} !")
        described_class.event_edited(target, before)
      end
      run_until(paris("23:10"))
      expect(mails.map(&:subject)).to eq([ "« Demain ! » a changé" ])
      run_until(paris("08:00") + 1.day)
      expect(mails.map(&:subject)).to include("« Football au parc ! » a changé")
    end

    it "holds a back-office suspension email until 08:00" do
      join(lea)
      run_until(paris("10:15"))
      mails.clear
      travel_to(paris("23:00"))
      Admin::EventActions.new(admin: create(:user, :admin)).suspend!(event)
      run_until(paris("07:00") + 1.day)
      expect(mails).to be_empty
      run_until(paris("08:00") + 1.day)
      expect(mails.map(&:to).flatten).to eq([ lea.email ])
    end

    it "holds hold-and-resume emails until 08:00" do
      join(lea)
      run_until(paris("10:15"))
      mails.clear
      travel_to(paris("23:00"))
      host.update!(verification_status: "expired")
      run_until(paris("07:00") + 1.day)
      expect(mails).to be_empty
      run_until(paris("08:00") + 1.day)
      expect(mails.map(&:to).flatten).to contain_exactly(lea.email, host.email)
    end
  end
  describe "US-17 requests (AC-17.25)" do
    let(:event) { create(:event, :with_approval, host: host, title: "Football au parc", starts_at: 3.days.from_now.change(hour: 14)) }

    it "E-A a request joins the host's 15-minute digest; a request withdrawn before it goes out is dropped" do
      join(lea, adults: 1, children: 2)
      join(karim)
      Events::Participations.new(event.reload, karim).withdraw!
      run_until(paris("10:16"))
      expect(mails_to(host).size).to eq(1)
      expect(mails_to(host).first.subject).to eq("Nouvelle demande pour « Football au parc »")
      expect(all_bodies).to include("Léa D. demande 3 places pour ta sortie.", "Tu as 1 demande en attente.")
      expect(all_bodies).not_to include("Karim")
    end

    it "E-B the parent hears at once when accepted, never with a phone or the address" do
      join(lea)
      Events::Requests.new(event.reload).accept!(EventParticipation.find_by(user: lea).id)
      perform_enqueued_jobs(at: Time.current)
      expect(mails_to(lea).map(&:subject)).to eq([ "Ta demande est acceptée : « Football au parc »" ])
      expect(all_bodies).not_to include("Oberkampf")
    end

    it "AC-17.19 E-D an expiry found during quiet hours is sent at once (PM decision)" do
      join(lea)
      travel_to(paris("23:00") + 2.days)
      ExpireEventRequestsJob.perform_now
      perform_enqueued_jobs(at: Time.current)
      expect(mails_to(lea).map(&:subject)).to eq([ "Ta demande pour « Football au parc » a expiré" ])
    end

    it "AC-17.19 E-D an expiry found at accept time in quiet hours is sent at once" do
      join(lea)
      travel_to(paris("23:30") + 2.days)
      expect { Events::Requests.new(event.reload).accept!(EventParticipation.find_by(user: lea).id) }
        .to raise_error(Events::Error)
      perform_enqueued_jobs(at: Time.current)
      expect(mails_to(lea).map(&:subject)).to eq([ "Ta demande pour « Football au parc » a expiré" ])
    end

    it "AC-17.22 a request closed for lost verification sends nothing", dropoff: true do
      locked = create(:event, :dropoff, host: host)
      Events::Participations.new(locked, lea).join!(adults: 1, children: 1, acknowledged: true)
      lea.update!(verification_status: "not_verified", verification_expires_on: nil)
      perform_enqueued_jobs(at: Time.current)
      expect(mails_to(lea)).to be_empty
    end
  end
end
