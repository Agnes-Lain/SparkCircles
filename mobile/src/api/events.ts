import type { ApiClient } from './client';
import type { CategoryKey } from '../components/CategoryPill';

// Events v1 (docs/api/events.md). Types written by hand from the contract, section numbers
// in comments. The audience (guest, member, participant, host) is decided by the server:
// optional fields below are present only for the audiences the contract lists.

type Client = Pick<ApiClient, 'request'>;

export type EventStatus = 'draft' | 'published' | 'suspended' | 'cancelled' | 'past';
export type JoinRule = 'anyone' | 'verified_only';
export type EventVisibility = 'searchable' | 'circles';
export type ViewerRole = 'guest' | 'member' | 'participant' | 'host';
export type JoinBlocker =
  | 'account_required'
  | 'verification_required'
  | 'full'
  | 'closed'
  | 'host'
  | 'joined'
  // §8 US-17: a pending request; no new request after a decline.
  | 'requested'
  | 'declined';
/** §8.1 The viewer's own request (US-17), never anyone else's. */
export type RequestStatus = 'pending' | 'declined' | 'expired' | 'closed';
export type ClosedReason = 'full' | 'cancelled' | 'verification';
export type MyRequest = {
  status: RequestStatus;
  closed_reason: ClosedReason | null;
  adults: number;
  children: number;
  places: number;
  requested_at: string | null;
  expires_at: string | null;
};
/** AC-16.1 The language the host wrote the event in. */
export type EventLanguage = 'fr' | 'en';
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
  /** §8.1 host only, until `phone_visible_until` (E.164). */
  emergency_phone?: string;
};

/** §8.1 Extra places asked while the accepted ones stay booked (AC-17.21). */
export type PendingChange = {
  adults: number;
  children: number;
  places: number;
  expires_at: string | null;
};

export type Participation = {
  adults: number;
  children: number;
  places: number;
  emergency_phone?: string | null;
  pending_change?: PendingChange | null;
};

/** §2 The event object. */
export type SparkEvent = {
  id: string;
  kind: 'family_hosted';
  status: EventStatus;
  /** A draft saves whatever was typed (BUG-8): these are null on a draft until filled in. */
  title: string | null;
  description: string | null;
  category: CategoryKey | null;
  /** AC-16.2: every audience; never translated (AC-16.4). */
  language: EventLanguage;
  tags: string[];
  starts_at: string | null;
  ends_at: string | null;
  time_zone: string;
  area: { key: string; label: string } | null;
  distance_km: number | null;
  age_min: number | null;
  age_max: number | null;
  join_rule: JoinRule;
  places: { total: number | null; taken: number; left: number };
  full: boolean;
  /** §8.1 US-17 (every audience): false = a drop-off event. */
  adult_required: boolean;
  /** §8.1 joining sends a request the host approves ("Sur demande"). */
  approval_required: boolean;
  viewer: {
    role: ViewerRole;
    joined: boolean;
    can_join: boolean;
    join_blocker: JoinBlocker | null;
    /** §8.1 the viewer's own request; null for guests and when there is none. */
    request?: MyRequest | null;
  };
  /** §2.2 / §2.3: guests get `{ verified }` only, members the full host. */
  host?: EventHost;
  /** §2.4 participants and host only. */
  exact_address?: string;
  participants?: EventParticipant[];
  my_participation?: Participation | null;
  /** §8.1 drop-off: the host's phone (host; accepted participants until `phone_visible_until`). */
  host_phone?: string;
  phone_visible_until?: string | null;
  /** Circles US-16: every non-guest audience; "circles" = visible to chosen circles only. */
  visibility?: EventVisibility;
  /** Circles AC-16.4: the chosen circles the viewer is in (all of them for the host). */
  circles?: { id: string; name: string }[];
  /** §8.1 host only. */
  pending_requests_count?: number;
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
  /** Web beta Q2: false = drop-off events are switched off (no "Présence d'un adulte" setting). */
  dropoff_enabled: boolean;
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
  /** Arrondissement keys; none = "Tout Paris" (no area filter for members). */
  area?: string[];
  radius_km?: number;
  category?: CategoryKey[];
  from?: string;
  to?: string;
  age_band?: AgeBand;
  tag?: string;
  q?: string;
  /** AC-16.3: none = every language. */
  language?: EventLanguage;
};

/** §3 POST /events and PATCH /events/:id body. */
export type EventParams = {
  title?: string;
  description?: string;
  category?: CategoryKey | null;
  starts_at?: string | null;
  ends_at?: string | null;
  area?: string | null;
  exact_address?: string;
  places_total?: number | null;
  age_min?: number | null;
  age_max?: number | null;
  tags?: string[];
  join_rule?: JoinRule;
  language?: EventLanguage;
  adult_required?: boolean;
  approval_required?: boolean;
  host_phone?: string | null;
  /** Circles US-16 */
  visibility?: EventVisibility;
  circle_ids?: string[];
};

export type PlacesParams = {
  adults: number;
  children: number;
  /** §8.2 drop-off: required with 0 adults. */
  emergency_phone?: string;
  /** §8.2 drop-off: "I stay responsible for my child" ticked. */
  responsibility_acknowledged?: boolean;
};

/** §8.3 A request waiting for the host. */
export type HostRequest = {
  id: string;
  first_name: string | null;
  last_name_initial: string | null;
  verified: boolean;
  former_member: boolean;
  extra: boolean;
  adults: number;
  children: number;
  places: number;
  current_places: number;
  /** AC-6.4b: the accepted adults and children if this request is accepted. */
  if_accepted: { adults: number; children: number };
  requested_at: string | null;
  expires_at: string | null;
};

/** §8.3 A decided request ("Terminées"). */
export type DoneRequest = {
  id: string;
  first_name: string | null;
  last_name_initial: string | null;
  verified: boolean;
  former_member: boolean;
  status: 'accepted' | 'declined' | 'withdrawn' | 'expired' | 'closed';
  closed_reason: ClosedReason | null;
  places: number;
  decided_at: string | null;
};

export type RequestList = {
  places_left: number;
  frozen: boolean;
  /** AC-6.4b: the accepted adults and children now. */
  totals: { adults: number; children: number };
  requests: HostRequest[];
  done: DoneRequest[];
};

/** React Query keys. Everything about events starts with `events`, so one call refreshes all. */
export const EVENTS_KEY = ['events'] as const;
export const EVENT_OPTIONS_KEY = ['events', 'options'] as const;
export const eventKey = (id: string) => ['events', 'detail', id] as const;
export const eventRequestsKey = (id: string) => ['events', 'requests', id] as const;
export const eventSearchKey = (search: EventSearch) => ['events', 'search', search] as const;
export const myEventsKey = (role: 'host' | 'participant', when: 'upcoming' | 'past') =>
  ['events', 'mine', role, when] as const;

/** The query string of GET /events, without empty values. */
export function searchQuery(search: EventSearch, page: number): string {
  const params: [string, string][] = [];
  const add = (key: string, value: string | number | undefined) => {
    if (value !== undefined && value !== '') params.push([key, String(value)]);
  };
  // One area as `area=paris-11`, several as `area[]=paris-11&area[]=paris-20` (contract).
  const areas = search.area ?? [];
  if (areas.length === 1) add('area', areas[0]);
  else areas.forEach((key) => add('area[]', key));
  if (areas.length && search.radius_km) add('radius_km', search.radius_km);
  if (search.category?.length) add('category', search.category.join(','));
  add('from', search.from);
  add('to', search.to);
  add('age_band', search.age_band);
  add('tag', search.tag);
  add('q', search.q);
  add('language', search.language);
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

    /** §8.2 DELETE /events/:id/participation/request: withdraws the pending request. */
    withdrawRequest: (id: string) =>
      client.request<{ event: SparkEvent }>(
        `/events/${encodeURIComponent(id)}/participation/request`,
        { method: 'DELETE' },
      ),

    /** §8.3 GET /events/:id/requests (host only). */
    requests: (id: string, signal?: AbortSignal) =>
      client.request<RequestList>(`/events/${encodeURIComponent(id)}/requests`, { signal }),

    /** §8.3 POST /events/:id/requests/:request_id/accept */
    acceptRequest: (id: string, requestId: string) =>
      client.request<{ event: SparkEvent }>(
        `/events/${encodeURIComponent(id)}/requests/${encodeURIComponent(requestId)}/accept`,
        { method: 'POST' },
      ),

    /** §8.3 POST /events/:id/requests/:request_id/decline */
    declineRequest: (id: string, requestId: string) =>
      client.request<{ event: SparkEvent }>(
        `/events/${encodeURIComponent(id)}/requests/${encodeURIComponent(requestId)}/decline`,
        { method: 'POST' },
      ),

    /** §8.3 POST /events/:id/requests/accept_all */
    acceptAll: (id: string) =>
      client.request<{ accepted: number; closed: number; event: SparkEvent }>(
        `/events/${encodeURIComponent(id)}/requests/accept_all`,
        { method: 'POST' },
      ),

    /** §3 POST /events/:id/reports */
    report: (id: string, reason: ReportReason, details?: string) =>
      client.request<{ report: { id: string; reason: ReportReason; created_at: string } }>(
        `/events/${encodeURIComponent(id)}/reports`,
        { method: 'POST', body: details ? { reason, details } : { reason } },
      ),
  };
}

export type EventsApi = ReturnType<typeof eventsApi>;
