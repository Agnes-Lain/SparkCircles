import type { TFunction } from 'i18next';

import type { EventHost, EventParticipant, SparkEvent } from '../../api/events';
import type { BadgeKind } from '../../components/Badge';
import type { Locale } from '../../i18n';
import { formatKm, formatShortDay, formatTime } from './format';

/** "Camille D." (first name + initial, accounts AC-6.1), or "Former member". */
export function personName(
  person: Pick<EventHost | EventParticipant, 'first_name' | 'last_name_initial' | 'former_member'>,
  t: TFunction,
): string {
  if (person.former_member || !person.first_name) return t('events.person.formerMember');
  return person.last_name_initial
    ? `${person.first_name} ${person.last_name_initial}.`
    : person.first_name;
}

/** A draft may have no title yet (BUG-8): "Sortie sans titre". */
export function titleText(event: SparkEvent, t: TFunction): string {
  return event.title ?? t('events.untitled');
}

/** "Plus que 4 places sur 10", "Plus qu'une place sur 10", "Complet · 10 places" (4.2). */
export function placesText(event: SparkEvent, t: TFunction): string {
  if (event.places.total === null) return t('events.noPlaces');
  if (event.full || event.places.left <= 0)
    return t('events.card.full', { total: event.places.total });
  return t('events.card.placesLeft', { count: event.places.left, total: event.places.total });
}

/** "Sam. 10 oct. · 15:00–17:00" */
export function whenText(event: SparkEvent, locale: Locale, t: TFunction): string {
  if (!event.starts_at || !event.ends_at) return t('events.noDate');
  const day = formatShortDay(event.starts_at, event.time_zone, locale);
  return `${day} · ${formatTime(event.starts_at, event.time_zone)}–${formatTime(event.ends_at, event.time_zone)}`;
}

/** "Paris 11e · à 1,5 km de ta zone", or the area alone without a chosen area. */
export function whereText(event: SparkEvent, t: TFunction, locale: Locale): string {
  if (!event.area) return t('events.noArea');
  if (event.distance_km === null) return event.area.label;
  return t('events.area.distance', {
    area: event.area.label,
    distance: formatKm(event.distance_km, locale),
  });
}

/** True once the event's end has passed (or the server says it is past). */
export function hasEnded(event: SparkEvent, now: Date = new Date()): boolean {
  if (event.status === 'past') return true;
  return event.ends_at !== null && new Date(event.ends_at).getTime() <= now.getTime();
}

export type StatusBadge = { kind: BadgeKind; label: string; key: string };

/**
 * The card's status badge (design 4.2): in "Mes sorties" the lifecycle (draft, published,
 * on hold, cancelled, ended); otherwise "You're going", "Full" or "Almost full" (≤ 3 left).
 */
export function statusBadge(
  event: SparkEvent,
  t: TFunction,
  mine: boolean,
  now: Date = new Date(),
): StatusBadge | null {
  const badge = (kind: BadgeKind, key: string): StatusBadge => ({
    kind,
    key,
    label: t(`events.status.${key}` as 'events.status.full'),
  });
  if (event.status === 'cancelled') return badge('badge-neutral', 'cancelled');
  if (event.status === 'suspended') return badge('badge-yellow', 'onHold');
  if (hasEnded(event, now)) return badge('badge-neutral', 'ended');
  if (event.status === 'draft') return badge('badge-neutral', 'draft');
  if (mine && event.viewer.role === 'host') return badge('badge-green', 'published');
  if (event.viewer.joined) return badge('badge-green', 'going');
  if (event.full || event.places.left <= 0) return badge('badge-neutral', 'full');
  if (event.places.left <= 3) return badge('badge-yellow', 'almostFull');
  return null;
}

/** "1 adulte, 2 enfants" / "2 adultes" (design E2 participant rows). */
export function partyText(adults: number, children: number, t: TFunction): string {
  const parts = [t('events.detail.adults', { count: adults })];
  if (children > 0) parts.push(t('events.detail.children', { count: children }));
  return parts.join(', ');
}
