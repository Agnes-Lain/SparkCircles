require "rails_helper"
require Rails.root.join("spec/mailers/previews/account_mailer_preview").to_s

RSpec.describe AccountMailer do
  let(:user) { create(:user, first_name: "Claire", locale: "fr") }

  it "writes to the user in their language (French)" do
    mail = described_class.confirmation_instructions(user, "token123")

    expect(mail.subject).to eq("Confirme ton e-mail")
    expect(mail.to).to eq([ user.email ])
    expect(mail.text_part.body.to_s).to include("Bonjour Claire", "confirm-email?token=token123")
  end

  it "writes in English for English-speaking users" do
    user.update!(locale: "en")
    mail = described_class.reset_password_instructions(user, "abc")

    expect(mail.subject).to eq("Reset your password")
    expect(mail.html_part.body.to_s).to include("reset-password?token=abc")
  end

  it "builds app links from APP_LINK_BASE (Expo Go in development: exp://<LAN IP>:8081/--)" do
    allow(Rails.configuration.x).to receive(:app_link_base).and_return("exp://192.168.1.77:8081/--")
    mail = described_class.confirmation_instructions(user, "token123")

    expect(mail.text_part.body.to_s).to include("exp://192.168.1.77:8081/--/confirm-email?token=token123")
  end

  it "AC-13.2 sends the email-change link to the new address" do
    mail = described_class.confirmation_instructions(user, "t", to: "new@example.com")

    expect(mail.to).to eq([ "new@example.com" ])
    expect(mail.subject).to eq("Confirme ta nouvelle adresse e-mail")
  end

  it "AC-13.7 sends the notice to the old address with a This wasn't me link" do
    change = create(:email_change, user: user, previous_email: "old@example.com")
    mail = described_class.email_changed_notice(change)

    expect(mail.to).to eq([ "old@example.com" ])
    body = mail.text_part.body.to_s
    expect(body).to include("this-wasnt-me?token=", "Ce n'était pas moi")
    token = CGI.unescape(body[/this-wasnt-me\?token=(\S+)/, 1])
    expect(EmailChange.find_by_token_for(:report, token)).to eq(change)
  end

  it "AC-10.6 never puts sensitive data other than the first name in emails" do
    user.update!(last_name: "Durand", date_of_birth: Date.new(1990, 1, 1))
    mail = described_class.account_locked(user)

    expect(mail.body.encoded).not_to include("Durand", "1990")
  end
end

RSpec.describe AccountMailerPreview do
  AccountMailerPreview.emails.each do |email|
    %w[fr en].each do |locale|
      it "renders #{email} in #{locale} without missing translations" do
        mail = AccountMailerPreview.new(locale: locale).public_send(email)
        body = mail.text_part.body.to_s + mail.html_part.body.to_s

        expect(mail.subject).to be_present
        expect(body + mail.subject).not_to match(/translation missing|Translation missing|%\{/)
      end
    end
  end
end

RSpec.describe "French and brand copy" do
  it "uses \"tu\" in every French text (design system v1.4, voice and tone)" do
    french = Rails.root.join("config/locales/fr.yml").read

    expect(french).not_to match(/\b(vous|votre|vos|veuillez)\b/i)
  end

  it "writes the brand as SparkCircles" do
    copy = %w[config/locales/fr.yml config/locales/en.yml app/views/layouts/mailer.html.erb].map { |path| Rails.root.join(path).read }.join

    expect(copy).not_to include("SPARKCIRCLES")
    expect(copy).to include("SparkCircles")
  end
end
