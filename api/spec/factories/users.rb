FactoryBot.define do
  factory :user do
    first_name { "Claire" }
    last_name { "Martin" }
    sequence(:email) { |n| "parent#{n}@example.com" }
    password { "correct-horse-battery" }
    locale { "en" }
    confirmed_at { 1.day.ago }
    adult_confirmed_at { 1.day.ago }
    terms_version { Rails.configuration.x.legal[:terms_version] }
    terms_accepted_at { 1.day.ago }
    privacy_version { Rails.configuration.x.legal[:privacy_version] }
    privacy_accepted_at { 1.day.ago }

    # Devise sends a confirmation email on create unless the account is already confirmed.
    before(:create) { |user| user.skip_confirmation_notification! if user.confirmed_at }

    trait :unconfirmed do
      confirmed_at { nil }
    end

    trait :verified do
      verification_status { "verified" }
      verification_expires_on { 1.year.from_now.to_date }
    end

    trait :pending_verification do
      verification_status { "pending" }
    end

    trait :closed do
      closed_at { 2.days.ago }
    end

    trait :admin do
      otp_secret { User.generate_otp_secret }
      otp_required_for_login { true }
      after(:create) { |user| user.roles.create!(name: "admin") }
    end
  end
end
