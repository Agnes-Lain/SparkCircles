json.categories Event::CATEGORIES do |key|
  json.key key
  json.label I18n.t("events.categories.#{key}.label")
  json.help I18n.t("events.categories.#{key}.help")
end
json.areas EventArea.all do |area|
  json.key area.key
  json.label area.label
  json.city area.city
end
json.age_bands Event::AGE_BANDS.keys
json.report_reasons EventReport::REASONS do |key|
  json.key key
  json.label I18n.t("events.report_reasons.#{key}")
end
json.limits do
  json.title Event::TITLE_MAX
  json.description Event::DESCRIPTION_MAX
  json.exact_address Event::ADDRESS_MAX
  json.tags EventTag::MAX_PER_EVENT
  json.tag_min EventTag::LENGTH.min
  json.tag_max EventTag::LENGTH.max
  json.places_min Event::PLACES.min
  json.places_max Event::PLACES.max
  json.report_details EventReport::DETAILS_MAX
end
