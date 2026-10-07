FactoryBot.define do
  factory :circle do
    name { "Parents CE2 · Jaurès" }
    description { "Les familles de la classe de Mme Roux." }
    area { "paris-11" }
    visibility { "public" }
    association :created_by, factory: %i[user verified]

    # The creator is the first admin and a member (AC-1.1).
    after(:create) do |circle|
      next if circle.created_by.nil?

      circle.memberships.create!(user: circle.created_by, status: "active", role: "admin", creator: true,
                                 joined_at: 1.week.ago, admin_since: 1.week.ago, seen_at: Time.current)
    end

    trait :private do
      visibility { "private" }
    end

    trait :suspended do
      status { "suspended" }
    end
  end

  factory :circle_membership do
    circle
    association :user, factory: %i[user verified]
    status { "active" }
    role { "member" }
    joined_at { Time.current }
    seen_at { Time.current }

    trait :pending do
      status { "pending" }
      requested_at { Time.current }
      joined_at { nil }
    end

    trait :admin do
      role { "admin" }
      admin_since { Time.current }
    end
  end
end
