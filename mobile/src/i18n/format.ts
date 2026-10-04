import type { Locale } from './index';

/**
 * A calendar date from the API ("2026-11-12") written for people: "12 Nov 2026" in English,
 * "12 nov. 2026" in French (design S10). Read as UTC so the day never shifts.
 */
export function formatDate(isoDate: string, locale: Locale): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function intlLocale(locale: Locale): string {
  return locale === 'en' ? 'en-GB' : 'fr-FR';
}

/** A calendar date ("2026-11-01") without the year: "1 Nov" / "1 nov." (design A1). */
export function formatDayMonth(isoDate: string, locale: Locale): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** A moment from the API ("2026-10-02T12:05:00Z") as a local day: "2 Oct" (design A6). */
export function formatMomentDay(isoTime: string, locale: Locale): string {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return isoTime;
  return new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', month: 'short' }).format(
    date,
  );
}

/** A moment as a local full date: "2 Oct 2026" (design A4). */
export function formatMomentDate(isoTime: string, locale: Locale): string {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return isoTime;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** A moment as a local day and time: "2 Oct, 14:05" (design A1, pending card). */
export function formatMomentDayTime(isoTime: string, locale: Locale): string {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return isoTime;
  const time = new Intl.DateTimeFormat(intlLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${formatMomentDay(isoTime, locale)}, ${time}`;
}

/** Today plus `days`, as an API calendar date ("2026-11-03"), in local time. */
export function isoDateInDays(days: number, from: Date = new Date()): string {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * For a date placed just before a full stop in the copy ("Requested on {{date}}."): French
 * short months already end with one ("2 oct."), so it isn't doubled.
 */
export function beforeFullStop(formatted: string): string {
  return formatted.replace(/\.$/, '');
}
