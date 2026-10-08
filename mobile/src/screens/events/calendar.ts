import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { SparkEvent } from '../../api/events';
import { hasEnded } from './presenters';

/** Fixed domain of the .ics UID, so a re-import updates the same calendar entry. */
export const ICS_UID_DOMAIN = 'sparkcircles.eu';
/** Never the address in the file name (design #41, 3). */
export const ICS_FILE_NAME = 'sortie-sparkcircles.ics';
const CRLF = '\r\n';
const MAX_OCTETS = 75;

/**
 * #41 step 1: the host and accepted participants only (not pending, declined, visitors or
 * guests), on a published event with a date that is not cancelled, on hold or over.
 */
export function canAddToCalendar(event: SparkEvent, now: Date = new Date()): boolean {
  const role = event.viewer.role;
  const allowed = role === 'host' || (role === 'participant' && event.viewer.joined);
  if (!allowed) return false;
  if (event.status !== 'published') return false;
  if (!event.starts_at || !event.ends_at) return false;
  return !hasEnded(event, now);
}

/** RFC 5545 3.3.11 TEXT: backslash, semicolon, comma and newlines escaped. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** RFC 5545 3.3.5 UTC date-time: 20261010T130000Z. */
export function icsDateTime(iso: string | Date): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

const utf8Length = (char: string) => {
  const code = char.codePointAt(0)!;
  if (code < 0x80) return 1;
  if (code < 0x800) return 2;
  if (code < 0x10000) return 3;
  return 4;
};

/**
 * RFC 5545 3.1 line folding: lines of at most 75 octets (UTF-8), continued on the next line
 * after CRLF + one space, never splitting a multi-byte character.
 */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let octets = 0;
  for (const char of line) {
    const size = utf8Length(char);
    // Continuation lines start with a space, which counts toward their 75 octets.
    const limit = parts.length === 0 ? MAX_OCTETS : MAX_OCTETS - 1;
    if (octets + size > limit) {
      parts.push(current);
      current = '';
      octets = 0;
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

export type IcsCopy = {
  /** "Sortie SparkCircles. Ouvre l'app pour les détails." */
  description: string;
};

/** The event's link in the app (Expo Router scheme from app.config.ts). */
export function eventAppLink(eventId: string): string {
  return `sparkcircles://events/${eventId}`;
}

/**
 * One VEVENT for the event (design #41, 3). LOCATION is the exact address only when the API
 * already gave it to this viewer, otherwise the area label. Never the host's phone, the
 * participants, the notes or any other private field.
 */
export function buildIcs(event: SparkEvent, copy: IcsCopy, now: Date = new Date()): string {
  if (!event.starts_at || !event.ends_at) throw new Error('The event has no date.');
  const location = event.exact_address ?? event.area?.label ?? null;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SparkCircles//Events//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@${ICS_UID_DOMAIN}`,
    `DTSTAMP:${icsDateTime(now)}`,
    `DTSTART:${icsDateTime(event.starts_at)}`,
    `DTEND:${icsDateTime(event.ends_at)}`,
    `SUMMARY:${escapeText(event.title ?? '')}`,
    ...(location ? [`LOCATION:${escapeText(location)}`] : []),
    `DESCRIPTION:${escapeText(`${copy.description}\n${eventAppLink(event.id)}`)}`,
    `URL:${eventAppLink(event.id)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}

export type CalendarShareResult = 'shared' | 'unavailable';

/**
 * Writes the .ics in the app cache and opens the system share sheet (iOS « Ajouter au
 * calendrier », Android calendar app), then deletes the file: nothing is sent anywhere.
 * Resolves 'unavailable' when sharing is not possible; throws when the file cannot be made.
 */
export async function shareEventCalendar(
  event: SparkEvent,
  copy: IcsCopy & { dialogTitle?: string },
): Promise<CalendarShareResult> {
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  const text = buildIcs(event, copy);
  const file = new File(Paths.cache, ICS_FILE_NAME);
  try {
    file.create({ overwrite: true });
    file.write(text);
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/calendar',
      UTI: 'public.calendar-event',
      dialogTitle: copy.dialogTitle,
    });
  } finally {
    if (file.exists) file.delete();
  }
  return 'shared';
}
