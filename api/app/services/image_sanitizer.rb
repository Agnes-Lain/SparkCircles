require "image_processing/vips"

# Re-encodes an ID photo or selfie before it is encrypted and stored (PM decision
# 2026-10-03, QA note on EXIF): all metadata is dropped (EXIF, GPS, XMP, IPTC, ICC),
# the photo is turned upright, and anything libvips can't read as an image is refused.
# PNG stays PNG; JPEG and HEIC become JPEG.
class ImageSanitizer
  class InvalidImage < StandardError; end

  MAX_PIXELS = 50_000_000 # refuses decompression bombs (a 12-megapixel photo is far below)
  JPEG_QUALITY = 90

  Result = Struct.new(:data, :content_type)

  def self.call(upload_or_data, content_type:)
    new.call(upload_or_data, content_type: content_type)
  end

  def call(upload_or_data, content_type:)
    data = upload_or_data.respond_to?(:read) ? upload_or_data.read.tap { upload_or_data.rewind } : upload_or_data
    png = content_type == "image/png"

    Tempfile.create([ "id-photo", ".img" ], binmode: true) do |source|
      source.write(data)
      source.flush
      check_dimensions!(source.path)

      output = ImageProcessing::Vips.source(source.path)
        .loader(fail_on: :error)
        .autorot
        .convert(png ? "png" : "jpg")
        .saver(keep: :none, **(png ? {} : { quality: JPEG_QUALITY }))
        .call
      begin
        Result.new(File.binread(output.path), png ? "image/png" : "image/jpeg")
      ensure
        output.close!
      end
    end
  rescue Vips::Error, ImageProcessing::Error => e
    raise InvalidImage, e.class.name
  end

  private

  def check_dimensions!(path)
    header = Vips::Image.new_from_file(path, access: :sequential)
    raise InvalidImage, "too many pixels" if header.width * header.height > MAX_PIXELS
  end
end
