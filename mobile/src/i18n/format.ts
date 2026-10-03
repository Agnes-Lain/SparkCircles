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
