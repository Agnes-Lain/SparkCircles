import { type InfiniteData, useInfiniteQuery } from '@tanstack/react-query';

import { mySpace } from '../../api';
import type { ApiError } from '../../api/errors';
import { AGENDA_KEY, type AgendaPage } from '../../api/mySpace';
import { pageWithoutPhones } from '../events/queries';

/**
 * `GET /me/agenda`, 30 days a page from today, then from `next_from` (docs/api/my-space.md).
 * Phones never stay in list pages (events AC-17.12); the cache is memory only (AC-6.4).
 */
export function useAgenda() {
  return useInfiniteQuery<
    AgendaPage,
    ApiError,
    InfiniteData<AgendaPage>,
    readonly unknown[],
    string | null
  >({
    queryKey: AGENDA_KEY,
    queryFn: async ({ pageParam, signal }) =>
      pageWithoutPhones(await mySpace().agenda(pageParam, signal)),
    initialPageParam: null,
    getNextPageParam: (last) => last.window.next_from ?? undefined,
  });
}

/** Every outing of the loaded pages, soonest first. */
export const agendaEvents = (data: InfiniteData<AgendaPage> | undefined) =>
  data?.pages.flatMap((page) => page.events) ?? [];

/** The last day the loaded pages cover ("2026-11-05"), or undefined before the first page. */
export const agendaLoadedUntil = (data: InfiniteData<AgendaPage> | undefined) =>
  data?.pages[data.pages.length - 1]?.window.to;
