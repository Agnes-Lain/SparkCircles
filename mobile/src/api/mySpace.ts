import type { ApiClient } from './client';
import type { SparkEvent } from './events';

// My space (docs/api/my-space.md). The agenda is the only endpoint of its own; the other
// Today blocks compose the events, circles and `me` endpoints.

type Client = Pick<ApiClient, 'request'>;

/** §2 The window of one agenda page: Paris dates, `to` included. */
export type AgendaWindow = { from: string; to: string; next_from: string | null };

/** §2 GET /me/agenda: my hosted, joined and circle outings, soonest first. */
export type AgendaPage = { events: SparkEvent[]; window: AgendaWindow };

/** Under `events` so every event mutation refreshes it (and strips it, see events queries). */
export const AGENDA_KEY = ['events', 'agenda'] as const;

export function mySpaceApi(client: Client) {
  return {
    /** §2 GET /me/agenda?from=YYYY-MM-DD (today when omitted). */
    agenda: (from: string | null, signal?: AbortSignal) =>
      client.request<AgendaPage>(
        from ? `/me/agenda?from=${encodeURIComponent(from)}` : '/me/agenda',
        { signal },
      ),
  };
}

export type MySpaceApi = ReturnType<typeof mySpaceApi>;
