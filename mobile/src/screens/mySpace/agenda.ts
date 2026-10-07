import type { TFunction } from 'i18next';

import type { SparkEvent } from '../../api/events';
import type { Locale } from '../../i18n';
import { addDays, formatLongDay, formatShortDay, zonedDate, zonedToday } from '../events/format';
import { titleText } from '../events/presenters';

// My space agenda (design my-space 2.3): pure helpers shared by Today and the full Agenda.

/** v1 events are all in Paris (the API's zone); the agenda's days are Paris days. */
export const AGENDA_ZONE = 'Europe/Paris';

/** mine = I host or I'm going; circle = a circle outing I haven't joined; cancelled. */
export type AgendaKind = 'mine' | 'circle' | 'cancelled';

export function agendaKind(event: SparkEvent): AgendaKind {
  if (event.status === 'cancelled') return 'cancelled';
  return event.viewer.role === 'host' || event.viewer.role === 'participant' ? 'mine' : 'circle';
}

export const todayInZone = (now: Date = new Date()) => zonedToday(AGENDA_ZONE, now);

/** The Paris day an outing starts on ("2026-10-07"). */
export function eventDay(event: SparkEvent): string {
  return event.starts_at ? zonedDate(event.starts_at, event.time_zone || AGENDA_ZONE) : '';
}

/** AC-1.1: the next outing I host or go to, whatever the date; never a cancelled one. */
export function nextOuting(events: SparkEvent[]): SparkEvent | undefined {
  return events.find((event) => agendaKind(event) === 'mine');
}

export type DayGroup = { day: string; events: SparkEvent[] };

/** Outings grouped by day, in the order received (the API sends them soonest first). */
export function groupByDay(events: SparkEvent[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const event of events) {
    const day = eventDay(event);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.events.push(event);
    else groups.push({ day, events: [event] });
  }
  return groups;
}

/** Design 2.3: up to 5 day groups or 8 rows inline, whichever comes first. */
export function inlineGroups(groups: DayGroup[], maxGroups = 5, maxRows = 8) {
  const shown: DayGroup[] = [];
  let rows = 0;
  for (const group of groups) {
    if (shown.length >= maxGroups || rows >= maxRows) break;
    const room = maxRows - rows;
    shown.push(
      group.events.length > room ? { ...group, events: group.events.slice(0, room) } : group,
    );
    rows += Math.min(group.events.length, room);
  }
  const total = groups.reduce((sum, group) => sum + group.events.length, 0);
  return { groups: shown, truncated: rows < total };
}

/** The 7 days of the strip, rolling from today (design Q3), `week` weeks ahead. */
export function stripDays(today: string, week = 0): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(today, week * 7 + index));
}

/** Up to 3 dots for a day, in the order of its outings. */
export function dayDots(events: SparkEvent[]): AgendaKind[] {
  return events.slice(0, 3).map(agendaKind);
}

/** The first day from `day` (included) that has an outing, among `days`. */
export function firstDayWithOutings(day: string, days: string[]): string | undefined {
  return [...days].sort().find((candidate) => candidate >= day);
}

const noon = (day: string) => `${day}T12:00:00Z`;

/** Strip cell: weekday abbreviation ("mer.", "Wed") and day number ("7"). */
export function stripCellParts(day: string, locale: Locale) {
  const weekday = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    timeZone: 'UTC',
    weekday: 'short',
  }).format(new Date(noon(day)));
  return { weekday, number: String(Number(day.slice(8, 10))) };
}

/** List day header: « Aujourd'hui · Mer. 7 oct. », « Demain », « Vendredi 9 oct. ». */
export function dayHeader(day: string, today: string, locale: Locale, t: TFunction): string {
  if (day === today) {
    const short = formatShortDay(noon(day), 'UTC', locale);
    const shown = locale === 'fr' ? short.charAt(0).toLowerCase() + short.slice(1) : short;
    return `${t('mySpace.agenda.today')} · ${shown}`;
  }
  if (day === addDays(today, 1)) return t('mySpace.agenda.tomorrow');
  return formatLongDay(noon(day), 'UTC', locale)
    .split(' ')
    .slice(0, 3)
    .join(' ')
    .replace(/(\d+) (\p{L}+)$/u, (_, n: string, month: string) => `${n} ${shortMonth(month)}`);
}

function shortMonth(month: string): string {
  // "octobre" → "oct.", "October" → "Oct"; months of 4 letters or fewer stay whole.
  if (month.length <= 4) return month;
  return /^[A-Z]/.test(month) ? month.slice(0, 3) : `${month.slice(0, 3)}.`;
}

/** Month header of the long list: « Novembre 2026 » / "November 2026". */
export function monthHeader(day: string, locale: Locale): string {
  const text = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(new Date(noon(day)));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Strip cell label (design 5): « Mercredi 7 octobre, aujourd'hui, 1 sortie : Atelier… »,
 * « Jeudi 8 octobre, rien de prévu », « …, 1 sortie annulée ».
 */
export function stripCellLabel(
  day: string,
  today: string,
  events: SparkEvent[],
  locale: Locale,
  t: TFunction,
): string {
  const long = formatLongDay(noon(day), 'UTC', locale);
  const name = day === today ? t('mySpace.agenda.dayToday', { day: long }) : long;
  if (events.length === 0) return t('mySpace.agenda.dayNothing', { day: name });
  const live = events.filter((event) => event.status !== 'cancelled');
  const cancelled = events.length - live.length;
  const parts = [name];
  if (live.length)
    parts.push(
      t('mySpace.agenda.dayOutings', {
        count: live.length,
        titles: live.map((event) => titleText(event, t)).join(', '),
      }),
    );
  if (cancelled) parts.push(t('mySpace.agenda.dayCancelled', { count: cancelled }));
  return parts.join(', ');
}
