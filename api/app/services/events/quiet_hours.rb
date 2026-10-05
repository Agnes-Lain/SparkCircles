module Events
  # No non-urgent event email between 22:00 and 08:00, Paris time (events-emails section 3).
  module QuietHours
    ZONE = "Europe/Paris"
    STARTS = 22
    ENDS = 8

    module_function

    def quiet?(time = Time.current)
      hour = time.in_time_zone(ZONE).hour
      hour >= STARTS || hour < ENDS
    end

    # The next 08:00 in Paris after `time` (today's if it's still before 08:00).
    def next_morning(time = Time.current)
      local = time.in_time_zone(ZONE)
      day = local.hour >= ENDS ? local.to_date + 1 : local.to_date
      ActiveSupport::TimeZone[ZONE].local(day.year, day.month, day.day, ENDS)
    end
  end
end
