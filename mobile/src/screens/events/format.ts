import type { Locale } from '../../i18n';

// Event times: the API sends UTC moments and the event's time zone ("Europe/Paris" in v1);
// the app always shows the event's local time, whatever the phone's zone.

function intlLocale(locale: Locale): string {
  return locale === 'en' ? 'en-GB' : 'fr-FR';
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type Parts = { year: number; month: number; day: number; hour: number; minute: number };

/** The wall-clock parts of a moment in a time zone. */
export function zonedParts(moment: Date, timeZone: string): Parts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(moment);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The local calendar day of a moment in a zone: "2026-10-10". */
export function zonedDate(moment: Date | string, timeZone: string): string {
  const p = zonedParts(typeof moment === 'string' ? new Date(moment) : moment, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "15:00" in the event's zone. */
export function formatTime(iso: string, timeZone: string): string {
  const p = zonedParts(new Date(iso), timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Card date: "Sam. 10 oct." / "Sat 10 Oct" (mockup events-list). */
export function formatShortDay(iso: string, timeZone: string, locale: Locale): string {
  const text = new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));
  return capitalize(text.replace(',', ''));
}

/** Day label and detail date: "Samedi 10 octobre" / "Saturday 10 October". */
export function formatLongDay(iso: string, timeZone: string, locale: Locale): string {
  const text = new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso));
  return capitalize(text.replace(',', ''));
}

/** A calendar day ("2026-10-10") as "Sam. 10 oct." (date chips, form summary). */
export function formatCalendarDay(isoDate: string, locale: Locale): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return formatShortDay(
    new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12)).toISOString(),
    'UTC',
    locale,
  );
}

/** "1,5" in French, "1.5" in English (distances). */
export function formatKm(km: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 }).format(km);
}

/**
 * The UTC moment of a wall-clock date and time in a zone ("2026-10-10", "15:00", Paris →
 * "2026-10-10T13:00:00.000Z"). Corrects once for the zone's offset at that moment (DST).
 */
export function zonedToUtc(isoDate: string, time: string, timeZone: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const wall = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0);
  const offsetAt = (moment: number) => {
    const p = zonedParts(new Date(moment), timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - moment;
  };
  let utc = wall - offsetAt(wall);
  utc = wall - offsetAt(utc);
  return new Date(utc).toISOString();
}

/** Today and the next days as calendar dates in a zone. */
export function zonedToday(timeZone: string, now: Date = new Date()): string {
  return zonedDate(now, timeZone);
}

/** Adds days to a calendar date ("2026-10-10" + 1 → "2026-10-11"). */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days));
  return date.toISOString().slice(0, 10);
}

/** "This weekend": Saturday and Sunday of this week; on a Sunday, only today. */
export function weekendRange(today: string): { from: string; to: string } {
  const [y, m, d] = today.split('-').map(Number);
  const weekday = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay(); // 0 = Sunday
  if (weekday === 0) return { from: today, to: today };
  const saturday = addDays(today, 6 - weekday);
  return { from: weekday === 6 ? today : saturday, to: addDays(saturday, 1) };
}

/** The phone's local clock time ("14:02"), for "Last updated". */
export function clockTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A request's deadline (US-17 pending state): "dim. 11 oct., 10 h" / "Sun 11 Oct, 10:00". */
export function formatDeadline(iso: string, timeZone: string, locale: Locale): string {
  const day = formatShortDay(iso, timeZone, locale);
  const p = zonedParts(new Date(iso), timeZone);
  if (locale === 'en') return `${day}, ${pad(p.hour)}:${pad(p.minute)}`;
  const clock = p.minute ? `${p.hour} h ${pad(p.minute)}` : `${p.hour} h`;
  return `${day.charAt(0).toLowerCase()}${day.slice(1)}, ${clock}`;
}
