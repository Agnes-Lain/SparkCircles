import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
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

/**
 * `GET /events/:id`. A 404 is an answer (not available), never retried. A 403 or 404 also
 * purges what the cache knew about the event (QA BUG-1), and a cancelled event seen by a
 * participant drops the address from the lists at once (AC-6.3).
 */
export function useEvent(id: string) {
  const client = useQueryClient();
  return useQuery<SparkEvent, ApiError>({
    queryKey: eventKey(id),
    queryFn: async ({ signal }) => {
      try {
        const { event } = await events().get(id, signal);
        stripIfCancelled(client, event);
        return event;
      } catch (error) {
        if (error instanceof ApiError && (error.status === 403 || error.status === 404))
          purgeEvent(client, id);
        throw error;
      }
    },
    enabled: Boolean(id),
  });
}

/**
 * Fetches the event again for its real state; `undefined` when it isn't visible any more.
 * A cancelled event drops its address from the lists at once, as in `useEvent` (QA R2-1).
 */
export async function freshEvent(client: QueryClient, id: string) {
  try {
    return await client.fetchQuery<SparkEvent, ApiError>({
      queryKey: eventKey(id),
      queryFn: async ({ signal }) => {
        const { event } = await events().get(id, signal);
        stripIfCancelled(client, event);
        return event;
      },
      staleTime: 0,
    });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404))
      purgeEvent(client, id);
    return undefined;
  }
}

/** Puts the event a mutation returned in the cache and refreshes every list (AC-1.8). */
export function storeEvent(client: QueryClient, event: SparkEvent) {
  client.setQueryData(eventKey(event.id), event);
  stripIfCancelled(client, event);
  refreshLists(client);
}

/** Refreshes the event and every list (after a delete or a refused action). */
export function refreshEvents(client: QueryClient, id?: string) {
  if (id) void client.invalidateQueries({ queryKey: eventKey(id) });
  refreshLists(client);
}

/**
 * AC-5.4, AC-6.3 (QA BUG-1): after a leave, the exact address, the participants and my
 * places leave the cache at once (not only when a refetch answers), then everything is
 * fetched again.
 */
export function forgetParticipation(client: QueryClient, id: string) {
  client.setQueryData<SparkEvent>(eventKey(id), (event) =>
    event
      ? {
          ...withoutInsiderDetails(event),
          viewer: {
            ...event.viewer,
            joined: false,
            role: event.viewer.role === 'participant' ? 'member' : event.viewer.role,
          },
        }
      : event,
  );
  stripFromLists(client, id);
  client.removeQueries({ queryKey: ['events', 'mine', 'participant'] });
  refreshEvents(client, id);
}

/** A 403 or 404: nothing about the event stays in the cache. */
export function purgeEvent(client: QueryClient, id: string) {
  client
    .getQueryCache()
    .find({ queryKey: eventKey(id), exact: true })
    ?.setState({ data: undefined });
  stripFromLists(client, id);
}

/** The event as a non-participant sees it: no exact address, participants or places. */
function withoutInsiderDetails(event: SparkEvent): SparkEvent {
  if (event.viewer.role === 'host') return event;
  const {
    exact_address: _address,
    participants: _people,
    my_participation: _mine,
    ...rest
  } = event;
  return rest;
}

/** AC-6.3: a cancelled event keeps no exact address or participants for a non-host. */
function stripIfCancelled(client: QueryClient, event: SparkEvent) {
  if (event.status === 'cancelled' && event.viewer.role !== 'host')
    stripFromLists(client, event.id);
}

/** Drops the insider details of one event from every cached list page, synchronously. */
function stripFromLists(client: QueryClient, id: string) {
  for (const query of client.getQueryCache().findAll({ queryKey: EVENTS_KEY })) {
    const kind = query.queryKey[1];
    if (kind !== 'search' && kind !== 'mine') continue;
    const data = query.state.data as InfiniteData<EventPage> | undefined;
    if (!data?.pages?.some((page) => page.events.some((event) => event.id === id))) continue;
    query.setState({
      data: {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          events: page.events.map((event) =>
            event.id === id ? withoutInsiderDetails(event) : event,
          ),
        })),
      },
    });
  }
}

function refreshLists(client: QueryClient) {
  void client.invalidateQueries({
    queryKey: EVENTS_KEY,
    predicate: (query) => query.queryKey[1] !== 'detail' && query.queryKey[1] !== 'options',
  });
}
