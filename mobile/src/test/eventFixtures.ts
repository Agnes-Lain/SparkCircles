import type { EventOptions, SparkEvent } from '../api/events';

// Event fixtures shaped like docs/api/events.md section 2 (member audience by default).

export const eventFixture: SparkEvent = {
  id: '5b0c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3',
  kind: 'family_hosted',
  status: 'published',
  title: 'Goûter et jeux au parc',
  description: 'Apporte un goûter à partager.',
  category: 'playdates',
  language: 'fr',
  tags: ['parc', 'goûter'],
  starts_at: '2026-10-10T13:00:00Z',
  ends_at: '2026-10-10T15:00:00Z',
  time_zone: 'Europe/Paris',
  area: { key: 'paris-11', label: 'Paris 11e' },
  distance_km: 1.5,
  age_min: 4,
  age_max: 8,
  join_rule: 'anyone',
  places: { total: 10, taken: 6, left: 4 },
  full: false,
  viewer: { role: 'member', joined: false, can_join: true, join_blocker: null },
  host: {
    id: '0192a1b2-0000-7000-8000-000000000009',
    first_name: 'Camille',
    last_name_initial: 'D',
    photo_url: null,
    verified: true,
    former_member: false,
  },
};

export const joinedEvent: SparkEvent = {
  ...eventFixture,
  places: { total: 10, taken: 9, left: 1 },
  viewer: { role: 'participant', joined: true, can_join: false, join_blocker: 'joined' },
  exact_address: '14 rue des Lilas, 75011 Paris',
  participants: [
    {
      first_name: 'Sofia',
      last_name_initial: 'R',
      verified: true,
      former_member: false,
      adults: 1,
      children: 2,
    },
  ],
  my_participation: { adults: 1, children: 2, places: 3 },
};

export const hostedEvent: SparkEvent = {
  ...eventFixture,
  viewer: { role: 'host', joined: false, can_join: false, join_blocker: 'host' },
  exact_address: '14 rue des Lilas, 75011 Paris',
  participants: [],
  my_participation: null,
  visibility: 'searchable',
  published_at: '2026-10-01T10:00:00Z',
  cancelled_at: null,
};

export const eventOptionsFixture: EventOptions = {
  categories: [
    { key: 'sport', label: 'Sport', help: 'Mouvement, jeux de ballon' },
    { key: 'playdates', label: 'Goûters', help: 'Goûters, jeux libres' },
  ],
  areas: [
    { key: 'paris-11', label: 'Paris 11e', city: 'Paris' },
    { key: 'paris-12', label: 'Paris 12e', city: 'Paris' },
    { key: 'paris-20', label: 'Paris 20e', city: 'Paris' },
  ],
  age_bands: ['0-2', '3-5', '6-8', '9-12', '13+'],
  report_reasons: [
    { key: 'dangerous_place', label: 'Lieu dangereux' },
    { key: 'suspicious_host', label: 'Organisateur suspect' },
    { key: 'inappropriate_content', label: 'Contenu inapproprié' },
    { key: 'inappropriate_tag', label: 'Tag inapproprié' },
    { key: 'other', label: 'Autre' },
  ],
  limits: {
    title: 80,
    description: 1000,
    tags: 5,
    tag_min: 2,
    tag_max: 24,
    places_min: 1,
    places_max: 100,
    report_details: 500,
  },
};

/** A page of GET /events or GET /me/events. */
export function eventPage(events: SparkEvent[], nextPage: number | null = null) {
  return { events, pagination: { page: 1, per_page: 20, next_page: nextPage } };
}

/** §2.2 The guest view of an "anyone" event: `host` is `{ verified }` only. */
export const guestEvent: SparkEvent = {
  ...eventFixture,
  viewer: { role: 'guest', joined: false, can_join: false, join_blocker: 'account_required' },
  // The guest serializer sends only the badge (no name, initial, avatar or id).
  host: { verified: true } as SparkEvent['host'],
};

/** §2.2 A "verified members only" event as a guest sees it: no `host` key at all. */
export const guestLockedEvent: SparkEvent = {
  ...guestEvent,
  id: '7c1d2e3f-4051-4b6c-9d7e-8f90a1b2c3d4',
  title: 'Après-midi jeux de société',
  category: 'board_games',
  join_rule: 'verified_only',
  places: { total: 8, taken: 6, left: 2 },
  viewer: { role: 'guest', joined: false, can_join: false, join_blocker: 'verification_required' },
  host: undefined,
};
