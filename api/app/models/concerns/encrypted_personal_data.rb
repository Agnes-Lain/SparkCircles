# Single place where models declare their sensitive personal data (spec US-10).
#
# Today every attribute is encrypted with Rails' Active Record Encryption and the
# application key set (setup decision D-16, Option A). Moving to per-user keys
# later (backlog #16) only changes this concern, not the models.
#
#   personal_data :last_name, :city_shown
#   personal_data :email, lookup: true   # deterministic: can be used in where/find_by
#   personal_data :date_of_birth, type: :date
module EncryptedPersonalData
  extend ActiveSupport::Concern

  class_methods do
    def personal_data(*names, lookup: false, type: nil)
      names.each do |name|
        attribute name, type if type
        if lookup
          encrypts name, deterministic: true, downcase: true
        else
          encrypts name
        end
      end
      personal_data_attributes.concat(names)
    end

    def personal_data_attributes
      @personal_data_attributes ||= []
    end
  end
end
