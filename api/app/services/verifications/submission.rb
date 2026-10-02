module Verifications
  # AC-7.3, AC-7.5: a parent sends a document, a selfie and their date of birth.
  # AC-7.15: a verified parent renewing early stays verified while the renewal is reviewed.
  # Images are encrypted before they reach storage (AC-10.2).
  class Submission
    Result = Struct.new(:status, :errors, :verification)

    FILES = { document_front: "document-front", document_back: "document-back", selfie: "selfie" }.freeze
    CONTENT_TYPE_COLUMNS = { document_front: :front_content_type, document_back: :back_content_type,
                             selfie: :selfie_content_type }.freeze
    ADULT_AGE = 18

    def initialize(user:, params:)
      @user = user
      @params = params
    end

    def call
      return Result.new(:pending_exists) if @user.verifications.pending.exists?

      errors = validate
      return Result.new(:invalid, errors) if errors.any?

      errors = sanitize_images
      return Result.new(:invalid, errors) if errors.any?

      verification = nil
      renewal = @user.verified? # AC-7.15
      User.transaction do
        verification = @user.verifications.build(document_type: document_type, submitted_at: Time.current, renewal: renewal)
        sanitized.each do |name, image|
          verification.public_send("#{CONTENT_TYPE_COLUMNS[name]}=", image.content_type)
          verification.attach_encrypted(name, image.data, filename: FILES[name])
        end
        verification.save!
        @user.update!(date_of_birth: date_of_birth, verification_status: renewal ? "verified" : "pending")
      end
      Result.new(:created, nil, verification)
    rescue ActiveRecord::RecordNotUnique
      Result.new(:pending_exists)
    end

    private

    def document_type = @params[:document_type].to_s

    def files
      names = FILES.keys
      names -= [ :document_back ] unless Verification.double_sided?(document_type)
      names.index_with { |name| @params[name] }
    end

    def date_of_birth
      @date_of_birth ||= Date.iso8601(@params[:date_of_birth].to_s)
    rescue Date::Error
      nil
    end

    def validate
      errors = ActiveModel::Errors.new(Verification.new)
      errors.add(:document_type, :inclusion) unless Verification::DOCUMENT_TYPES.include?(document_type)
      if date_of_birth.nil?
        errors.add(:date_of_birth, @params[:date_of_birth].blank? ? :blank : :invalid)
      elsif date_of_birth > ADULT_AGE.years.ago.to_date
        errors.add(:date_of_birth, :invalid)
      end
      files.each do |name, upload|
        if !upload.respond_to?(:content_type)
          errors.add(name, :blank)
        elsif Verification::ALLOWED_CONTENT_TYPES.exclude?(upload.content_type) || !image_signature?(upload)
          errors.add(name, :invalid_type)
        elsif upload.size > Verification::MAX_FILE_SIZE
          errors.add(name, :too_large)
        end
      end
      errors
    end

    # Metadata (EXIF, GPS...) is removed before encryption and storage; files libvips
    # can't read as images are refused.
    def sanitize_images
      errors = ActiveModel::Errors.new(Verification.new)
      @sanitized = files.to_h do |name, upload|
        [ name, ImageSanitizer.call(upload, content_type: upload.content_type) ]
      rescue ImageSanitizer::InvalidImage
        errors.add(name, :invalid_type)
        [ name, nil ]
      end
      errors
    end

    def sanitized = @sanitized

    # The declared content type must match the file's first bytes (JPEG, PNG or HEIC).
    def image_signature?(upload)
      head = upload.read(12).to_s.b
      upload.rewind
      head.start_with?("\xFF\xD8\xFF".b) || head.start_with?("\x89PNG".b) ||
        (head.byteslice(4, 4) == "ftyp" && %w[heic heix mif1 msf1 hevc].include?(head.byteslice(8, 4)))
    end
  end
end
