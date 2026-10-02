class Role < ApplicationRecord
  NAMES = %w[parent admin].freeze

  belongs_to :user

  validates :name, inclusion: { in: NAMES }, uniqueness: { scope: :user_id }
end
