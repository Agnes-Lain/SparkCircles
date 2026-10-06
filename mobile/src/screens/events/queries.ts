import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';

import { events } from '../../api';
import { ApiError } from '../../api/errors';
import {
  EVENT_OPTIONS_KEY,
  type EventPage,
  type EventSearch,
  EVENTS_KEY,
  eventKey,
  eventSearchKey,
  myEventsKey,
  type SparkEvent,
} from '../../api/events';

/** Lists for the forms and filters (`GET /event_options`); they rarely change. */
export function useEventOptions() {
  return useQuery({
    queryKey: EVENT_OPTIONS_KEY,
    queryFn: ({ signal }) => events().options(signal),
    staleTime: 60 * 60_000,
  });
}

const nextPage = (last: EventPage) => last.pagination.next_page ?? undefined;

/** `GET /events`, soonest first, page after page (contract "Pagination"). */
export function useEventSearch(search: EventSearch, enabled: boolean) {
  return useInfiniteQuery<EventPage, ApiError, InfiniteData<EventPage>, readonly unknown[], number>(
    {
      queryKey: eventSearchKey(search),
      queryFn: ({ pageParam, signal }) => events().search(search, pageParam, signal),
      initialPageParam: 1,
      getNextPageParam: nextPage,
      enabled,
    },
  );
}

/** `GET /me/events` for one role and period (AC-7.1). */
export function useMyEvents(role: 'host' | 'participant', when: 'upcoming' | 'past') {
  return useInfiniteQuery<EventPage, ApiError, InfiniteData<EventPage>, readonly unknown[], number>(
    {
      queryKey: myEventsKey(role, when),
      queryFn: ({ pageParam, signal }) => events().mine(role, when, pageParam, signal),
      initialPageParam: 1,
      getNextPageParam: nextPage,
    },
  );
}

/** `GET /events/:id`. A 404 is an answer (not available), never retried. */
export function useEvent(id: string) {
  return useQuery<SparkEvent, ApiError>({
    queryKey: eventKey(id),
    queryFn: async ({ signal }) => (await events().get(id, signal)).event,
    enabled: Boolean(id),
  });
}

/** Puts the event a mutation returned in the cache and refreshes every list (AC-1.8). */
export function storeEvent(client: QueryClient, event: SparkEvent) {
  client.setQueryData(eventKey(event.id), event);
  void client.invalidateQueries({
    queryKey: EVENTS_KEY,
    predicate: (query) => query.queryKey[1] !== 'detail' && query.queryKey[1] !== 'options',
  });
}

/** Refreshes the event and every list (after a leave, a delete or a refused join). */
export function refreshEvents(client: QueryClient, id?: string) {
  if (id) void client.invalidateQueries({ queryKey: eventKey(id) });
  void client.invalidateQueries({
    queryKey: EVENTS_KEY,
    predicate: (query) => query.queryKey[1] !== 'detail' && query.queryKey[1] !== 'options',
  });
}
