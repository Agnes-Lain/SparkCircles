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

  it "AC-13.2 sends the email-change link to the new address" do
    mail = described_class.confirmation_instructions(user, "t", to: "new@example.com")

    expect(mail.to).to eq([ "new@example.com" ])
    expect(mail.subject).to eq("Confirme ta nouvelle adresse e-mail")
  end

  it "AC-13.7 sends the notice to the old address with a This wasn't me link" do
    change = create(:email_change, user: user, previous_email: "old@example.com")
    mail = described_class.email_changed_notice(change, "report-token")

    expect(mail.to).to eq([ "old@example.com" ])
    expect(mail.text_part.body.to_s).to include("this-wasnt-me?token=report-token", "Ce n'était pas moi")
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
