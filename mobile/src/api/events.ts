import type { ApiClient } from './client';
import type { CategoryKey } from '../components/CategoryPill';

// Events v1 (docs/api/events.md). Types written by hand from the contract, section numbers
// in comments. The audience (guest, member, participant, host) is decided by the server:
// optional fields below are present only for the audiences the contract lists.

type Client = Pick<ApiClient, 'request'>;

export type EventStatus = 'draft' | 'published' | 'suspended' | 'cancelled' | 'past';
export type JoinRule = 'anyone' | 'verified_only';
export type ViewerRole = 'guest' | 'member' | 'participant' | 'host';
export type JoinBlocker =
  'account_required' | 'verification_required' | 'full' | 'closed' | 'host' | 'joined';
export type AgeBand = '0-2' | '3-5' | '6-8' | '9-12' | '13+';
export type ReportReason =
  'dangerous_place' | 'suspicious_host' | 'inappropriate_content' | 'inappropriate_tag' | 'other';

/** §2.3 The host as members see them; a former member has every field null. */
export type EventHost = {
  id: string | null;
  first_name: string | null;
  last_name_initial: string | null;
  photo_url: string | null;
  verified: boolean;
  former_member: boolean;
};

/** §2.4 A participant row (participants and host only): no avatar, no id. */
export type EventParticipant = {
  first_name: string | null;
  last_name_initial: string | null;
  verified: boolean;
  former_member: boolean;
  adults: number;
  children: number;
};

export type Participation = { adults: number; children: number; places: number };

/** §2 The event object. */
export type SparkEvent = {
  id: string;
  kind: 'family_hosted';
  status: EventStatus;
  title: string;
  description: string | null;
  category: CategoryKey;
  tags: string[];
  starts_at: string;
  ends_at: string;
  time_zone: string;
  area: { key: string; label: string };
  distance_km: number | null;
  age_min: number | null;
  age_max: number | null;
  join_rule: JoinRule;
  places: { total: number; taken: number; left: number };
  full: boolean;
  viewer: {
    role: ViewerRole;
    joined: boolean;
    can_join: boolean;
    join_blocker: JoinBlocker | null;
  };
  /** §2.2 / §2.3: guests get `{ verified }` only, members the full host. */
  host?: EventHost;
  /** §2.4 participants and host only. */
  exact_address?: string;
  participants?: EventParticipant[];
  my_participation?: Participation | null;
  /** §2.4 host only. */
  visibility?: 'searchable';
  published_at?: string | null;
  cancelled_at?: string | null;
};

export type Pagination = { page: number; per_page: number; next_page: number | null };
export type EventPage = { events: SparkEvent[]; pagination: Pagination };

/** §3 GET /event_options */
export type EventOptions = {
  categories: { key: CategoryKey; label: string; help: string }[];
  areas: { key: string; label: string; city: string }[];
  age_bands: AgeBand[];
  report_reasons: { key: ReportReason; label: string }[];
  limits: {
    title: number;
    description: number;
    tags: number;
    tag_min: number;
    tag_max: number;
    places_min: number;
    places_max: number;
    report_details: number;
  };
};

/** §3 GET /events filters (the page is added by the list). */
export type EventSearch = {
  area?: string;
  radius_km?: number;
  category?: CategoryKey[];
  from?: string;
  to?: string;
  age_band?: AgeBand;
  tag?: string;
  q?: string;
};

/** §3 POST /events and PATCH /events/:id body. */
export type EventParams = {
  title?: string;
  description?: string;
  category?: CategoryKey;
  starts_at?: string;
  ends_at?: string;
  area?: string;
  exact_address?: string;
  places_total?: number;
  age_min?: number | null;
  age_max?: number | null;
  tags?: string[];
  join_rule?: JoinRule;
};

export type PlacesParams = { adults: number; children: number };

/** React Query keys. Everything about events starts with `events`, so one call refreshes all. */
export const EVENTS_KEY = ['events'] as const;
export const EVENT_OPTIONS_KEY = ['events', 'options'] as const;
export const eventKey = (id: string) => ['events', 'detail', id] as const;
export const eventSearchKey = (search: EventSearch) => ['events', 'search', search] as const;
export const myEventsKey = (role: 'host' | 'participant', when: 'upcoming' | 'past') =>
  ['events', 'mine', role, when] as const;

/** The query string of GET /events, without empty values. */
export function searchQuery(search: EventSearch, page: number): string {
  const params: [string, string][] = [];
  const add = (key: string, value: string | number | undefined) => {
    if (value !== undefined && value !== '') params.push([key, String(value)]);
  };
  add('area', search.area);
  if (search.area && search.radius_km) add('radius_km', search.radius_km);
  if (search.category?.length) add('category', search.category.join(','));
  add('from', search.from);
  add('to', search.to);
  add('age_band', search.age_band);
  add('tag', search.tag);
  add('q', search.q);
  add('page', page);
  return params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

export function eventsApi(client: Client) {
  return {
    /** §3 GET /event_options */
    options: (signal?: AbortSignal) => client.request<EventOptions>('/event_options', { signal }),

    /** §3 GET /events */
    search: (search: EventSearch, page: number, signal?: AbortSignal) =>
      client.request<EventPage>(`/events?${searchQuery(search, page)}`, { signal }),

    /** §3 GET /events/:id */
    get: (id: string, signal?: AbortSignal) =>
      client.request<{ event: SparkEvent }>(`/events/${encodeURIComponent(id)}`, { signal }),

    /** §3 GET /me/events */
    mine: (
      role: 'host' | 'participant',
      when: 'upcoming' | 'past',
      page: number,
      signal?: AbortSignal,
    ) => client.request<EventPage>(`/me/events?role=${role}&when=${when}&page=${page}`, { signal }),

    /** §3 POST /events: a draft, or published at once with `publish`. */
    create: (event: EventParams, publish: boolean) =>
      client.request<{ event: SparkEvent }>('/events', {
        method: 'POST',
        body: { event, publish },
      }),

    /** §3 PATCH /events/:id */
    update: (id: string, event: EventParams) =>
      client.request<{ event: SparkEvent }>(`/events/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: { event },
      }),

    /** §3 DELETE /events/:id (drafts only, permanent). */
    remove: (id: string) =>
      client.request<void>(`/events/${encodeURIComponent(id)}`, { method: 'DELETE' }),

    /** §3 POST /events/:id/publish */
    publish: (id: string) =>
      client.request<{ event: SparkEvent }>(`/events/${encodeURIComponent(id)}/publish`, {
        method: 'POST',
      }),

    /** §3 POST /events/:id/cancel */
    cancel: (id: string) =>
      client.request<{ event: SparkEvent }>(`/events/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
      }),

    /** §3 POST /events/:id/participation */
    join: (id: string, places: PlacesParams) =>
      client.request<{ event: SparkEvent }>(`/events/${encodeURIComponent(id)}/participation`, {
        method: 'POST',
        body: places,
      }),

    /** §3 PATCH /events/:id/participation */
    changePlaces: (id: string, places: PlacesParams) =>
      client.request<{ event: SparkEvent }>(`/events/${encodeURIComponent(id)}/participation`, {
        method: 'PATCH',
        body: places,
      }),

    /** §3 DELETE /events/:id/participation */
    leave: (id: string) =>
      client.request<void>(`/events/${encodeURIComponent(id)}/participation`, {
        method: 'DELETE',
      }),

    /** §3 POST /events/:id/reports */
    report: (id: string, reason: ReportReason, details?: string) =>
      client.request<{ report: { id: string; reason: ReportReason; created_at: string } }>(
        `/events/${encodeURIComponent(id)}/reports`,
        { method: 'POST', body: details ? { reason, details } : { reason } },
      ),
  };
}

export type EventsApi = ReturnType<typeof eventsApi>;
