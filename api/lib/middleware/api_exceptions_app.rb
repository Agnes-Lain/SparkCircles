# Errors raised before or outside a controller (malformed query strings such as
# "area=x&area[]=y", unknown routes, crashes) answer the API's error shape
# { "error": { "code", "message" } } on /api paths (docs/api, section 1). The back office
# keeps Rails' default pages.
class ApiExceptionsApp
  CODES = { 400 => "bad_request", 404 => "not_found", 429 => "rate_limited" }.freeze

  def initialize(fallback)
    @fallback = fallback
  end

  def call(env)
    request = ActionDispatch::Request.new(env)
    return @fallback.call(env) unless request.original_fullpath.to_s.start_with?("/api/")

    status = request.path_info[1..].to_i
    code = CODES.fetch(status) { status < 500 ? "bad_request" : "server_error" }
    body = { error: { code: code, message: I18n.t("api.errors.#{code}") } }.to_json
    [ status, { "content-type" => "application/json; charset=utf-8", "content-length" => body.bytesize.to_s }, [ body ] ]
  end
end
