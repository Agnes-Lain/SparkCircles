FactoryBot.define do
  factory :event do
    association :host, factory: %i[user verified]
    title { "Football au parc" }
    description { "Petit match pour les 6-10 ans." }
    category { "sport" }
    starts_at { 3.days.from_now.change(hour: 10) }
    ends_at { starts_at + 2.hours }
    area { "paris-11" }
    exact_address { "12 rue Oberkampf, 75011 Paris" }
    places_total { 10 }
    join_rule { "anyone" }
    tags { %w[foot plein-air] }
    status { "published" }
    published_at { Time.current }

    trait :draft do
      status { "draft" }
      published_at { nil }
    end

    trait :verified_only do
      join_rule { "verified_only" }
    end

    trait :suspended do
      status { "suspended" }
      suspension_reason { "host_unverified" }
    end

    trait :cancelled do
      status { "cancelled" }
    end

    # Past events can't be created through validations (the start must be ahead).
    trait :ended do
      to_create { |event| event.save!(validate: false) }
      starts_at { 2.days.ago }
    end
  end

  factory :event_participation do
    event
    association :user, factory: %i[user verified]
    adults { 1 }
    children { 1 }
    after(:create) { |participation| participation.event.increment!(:places_taken, participation.requested_places) }
  end
end
