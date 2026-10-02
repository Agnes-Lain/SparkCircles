require "rails_helper"

RSpec.describe User do
  describe "AC-10.1 encryption at rest" do
    it "never stores sensitive fields in plain text" do
      user = create(:user, email: "claire@example.com", last_name: "Martin", city_shown: "Croix-Rousse",
                           date_of_birth: Date.new(1990, 5, 17), verification_expires_on: Date.new(2028, 1, 1))

      raw = User.connection.select_one(
        "SELECT email, last_name, city_shown, date_of_birth, verification_expires_on, encrypted_password FROM users WHERE id = #{User.connection.quote(user.id)}"
      )
      expect(raw.values.join).not_to include("claire@example.com", "Martin", "Croix-Rousse", "1990-05-17", "2028-01-01",
                                             "correct-horse-battery")
      expect(user.reload).to have_attributes(email: "claire@example.com", last_name: "Martin", date_of_birth: Date.new(1990, 5, 17))
    end

    it "AC-10.3 keeps the keys outside the database" do
      key = ActiveRecord::Encryption.config.primary_key
      dump = User.connection.select_values("SELECT row_to_json(users)::text FROM users").join

      expect(key).to be_present
      expect(dump).not_to include(key)
    end

    it "finds an account by email despite encryption, ignoring case" do
      user = create(:user, email: "claire@example.com")

      expect(User.find_by(email: "CLAIRE@example.com".downcase)).to eq(user)
    end

    it "declares all personal data in one place" do
      expect(User.personal_data_attributes).to include(:email, :last_name, :city_shown, :date_of_birth, :verification_expires_on)
    end
  end

  describe "AC-1.5 AC-1.7 roles" do
    it "creates every account with the parent role only" do
      expect(create(:user).role_names).to eq([ "parent" ])
    end

    it "adds and removes roles on the same account" do
      user = create(:user)
      user.roles.create!(name: "admin")
      expect(user.reload).to be_admin

      user.roles.where(name: "admin").delete_all
      expect(user.reload).not_to be_admin
      expect(User.exists?(user.id)).to be(true)
    end

    it "refuses unknown roles at the database level" do
      user = create(:user)
      expect { user.roles.insert_all!([ { name: "superuser" } ]) }.to raise_error(ActiveRecord::StatementInvalid)
    end
  end

  describe "#verified? (AC-7.13, AC-7.14, AC-8.5)" do
    it "is true only for a verified status with a future expiry date" do
      expect(build(:user, :verified)).to be_verified
      expect(build(:user, verification_status: "pending")).not_to be_verified
      expect(build(:user, verification_status: "verified", verification_expires_on: Date.current)).not_to be_verified
    end

    it "AC-8.5 becomes false the moment the expiry date is reached, before any job runs" do
      user = create(:user, verification_status: "verified", verification_expires_on: 3.days.from_now.to_date)

      travel_to(3.days.from_now) { expect(user.reload).not_to be_verified }
    end
  end

  describe "AC-1.4 password rules" do
    it "accepts a long uncommon password and refuses short, common or repetitive ones" do
      expect(build(:user, password: "correct-horse-battery")).to be_valid
      user = build(:user, password: "aaaaaaaaaaaa")
      user.validate
      expect(user.errors.details[:password]).to eq([ { error: :too_common } ])
    end
  end
end
