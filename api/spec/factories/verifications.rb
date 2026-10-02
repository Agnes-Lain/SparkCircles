FactoryBot.define do
  factory :verification do
    user
    document_type { "national_id_card" }
    submitted_at { 2.hours.ago }
    front_content_type { "image/jpeg" }
    back_content_type { "image/jpeg" }
    selfie_content_type { "image/jpeg" }

    after(:build) do |verification|
      image = Rails.root.join("spec/fixtures/files/photo.jpg").binread
      verification.attach_encrypted(:document_front, image, filename: "document-front")
      verification.attach_encrypted(:document_back, image, filename: "document-back") if verification.double_sided?
      verification.attach_encrypted(:selfie, image, filename: "selfie")
    end

    trait :approved do
      status { "approved" }
      decided_at { 1.day.ago }
      document_expires_on { 5.years.from_now.to_date }
    end

    trait :rejected do
      status { "rejected" }
      decided_at { 1.day.ago }
      rejection_reason { "photo_blurry" }
    end
  end
end
