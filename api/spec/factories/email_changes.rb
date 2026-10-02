FactoryBot.define do
  factory :email_change do
    user
    previous_email { "old@example.com" }
    new_email { user.email }
    changed_at { 1.hour.ago }
  end
end
