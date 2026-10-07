import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';

import { circles } from '../../api';
import {
  CIRCLES_KEY,
  type CircleDetail,
  type CirclePage,
  type CircleSearch,
  circleKey,
  circleSearchKey,
  type Invitation,
  type InvitationKey,
  type InvitationPreview,
  invitationKey,
  type MemberCircle,
  MY_CIRCLES_KEY,
  type MyCircles,
  previewKey,
} from '../../api/circles';
import type { ApiError } from '../../api/errors';

/** `GET /circles`: my circles, requests and neutral cards (AC-9.1 to AC-9.3). */
export function useMyCircles(enabled = true) {
  return useQuery<MyCircles, ApiError>({
    queryKey: MY_CIRCLES_KEY,
    queryFn: ({ signal }) => circles().mine(signal),
    enabled,
  });
}

/** `GET /circles/:id`: the member view, a paused/closed status, or the public page. */
export function useCircle(id: string) {
  return useQuery<CircleDetail, ApiError>({
    queryKey: circleKey(id),
    queryFn: async ({ signal }) => (await circles().get(id, signal)).circle,
    enabled: Boolean(id),
  });
}

/** `GET /circles/:id/invitation` (admins). */
export function useInvitation(id: string) {
  return useQuery<Invitation, ApiError>({
    queryKey: invitationKey(id),
    queryFn: async ({ signal }) => (await circles().invitation(id, signal)).invitation,
    enabled: Boolean(id),
  });
}

/** `POST /circle_invitations/preview`: an answer, never retried (wrong tries are counted). */
export function useInvitationPreview(key: InvitationKey | null) {
  return useQuery<InvitationPreview, ApiError>({
    queryKey: previewKey(key ?? { code: '' }),
    queryFn: async () => (await circles().preview(key!)).circle,
    enabled: Boolean(key),
    retry: false,
    staleTime: 0,
  });
}

/** `GET /circles/search`, page after page, no total count (AC-17.9). */
export function useCircleSearch(search: CircleSearch, enabled: boolean) {
  return useInfiniteQuery<
    CirclePage,
    ApiError,
    InfiniteData<CirclePage>,
    readonly unknown[],
    number
  >({
    queryKey: circleSearchKey(search),
    queryFn: ({ pageParam, signal }) => circles().search(search, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => last.pagination.next_page ?? undefined,
    enabled,
  });
}

/** Puts the circle a mutation returned in the cache and refreshes the lists. */
export function storeCircle(client: QueryClient, circle: MemberCircle) {
  client.setQueryData(circleKey(circle.id), circle);
  refreshCircles(client);
}

/** Refreshes every circle list (and, when given, one circle). */
export function refreshCircles(client: QueryClient, id?: string) {
  if (id) void client.invalidateQueries({ queryKey: circleKey(id) });
  void client.invalidateQueries({
    queryKey: CIRCLES_KEY,
    predicate: (query) => query.queryKey[1] !== 'detail' && query.queryKey[1] !== 'invitation',
  });
}

/** A circle the viewer may no longer see: nothing about it stays in the cache (AC-5.4). */
export function forgetCircle(client: QueryClient, id: string) {
  client.removeQueries({ queryKey: circleKey(id) });
  client.removeQueries({ queryKey: invitationKey(id) });
  refreshCircles(client);
  // Circle outings may have gone with it (AC-16.5).
  void client.invalidateQueries({ queryKey: ['events'] });
}

/** "Claire D." */
export const displayName = (person: { first_name: string; last_name_initial: string }) =>
  `${person.first_name} ${person.last_name_initial}.`;

/** FR "2e", "1er"; EN "2nd". */
export function ordinal(count: number, locale: 'fr' | 'en'): string {
  if (locale === 'fr') return count === 1 ? '1er' : `${count}e`;
  const tens = count % 100;
  if (tens >= 11 && tens <= 13) return `${count}th`;
  return `${count}${['th', 'st', 'nd', 'rd'][count % 10] ?? 'th'}`;
}
