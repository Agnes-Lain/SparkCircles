import { useRouter } from 'expo-router';
import { type RefObject, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';

import type { SparkEvent } from '../../api/events';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { EventCard } from '../../components/EventCard';
import { FilterChip } from '../../components/FilterChip';
import { Notification } from '../../components/Notification';
import { usePullRefresh } from '../../hooks/usePullRefresh';
import { MIN_TOUCH_TARGET } from '../../theme/a11y';
import { colorValue } from '../../theme/colors';
import { BadgeSheet } from '../account/BadgeSheet';
import { EventListSkeleton } from './EventCardSkeleton';
import { useMyEvents } from './queries';

type When = 'upcoming' | 'past';
type Row =
  { kind: 'label'; key: string; label: string } | { kind: 'event'; key: string; event: SparkEvent };

/**
 * E1b "Mes sorties" (AC-7.1, 7.5): the events I host (drafts included) and the ones I joined,
 * upcoming or past (kept 90 days), each list loaded page after page.
 */
export function MyEvents() {
  const { t } = useTranslation();
  const router = useRouter();
  const [when, setWhen] = useState<When>('upcoming');
  const hosting = useMyEvents('host', when);
  const going = useMyEvents('participant', when);
  const pull = usePullRefresh(() => Promise.all([hosting.refetch(), going.refetch()]), 'events');
  const [badgeOpener, setBadgeOpener] = useState<RefObject<View | null> | null>(null);

  const rows = useMemo(() => {
    const list: Row[] = [];
    const hosted = hosting.data?.pages.flatMap((p) => p.events) ?? [];
    const joined = going.data?.pages.flatMap((p) => p.events) ?? [];
    if (hosted.length) {
      list.push({ kind: 'label', key: 'hosting', label: t('events.mine.hosting') });
      hosted.forEach((event) => list.push({ kind: 'event', key: `h-${event.id}`, event }));
    }
    // The participant list starts once every hosted page is shown, so the order holds.
    if (joined.length && !hosting.hasNextPage) {
      list.push({ kind: 'label', key: 'going', label: t('events.mine.going') });
      joined.forEach((event) => list.push({ kind: 'event', key: `p-${event.id}`, event }));
    }
    return list;
  }, [hosting.data, hosting.hasNextPage, going.data, t]);

  const loading = hosting.isPending || going.isPending;
  const error = hosting.error ?? going.error;
  const loadingMore = hosting.isFetchingNextPage || going.isFetchingNextPage;

  const loadMore = () => {
    if (loadingMore || error) return;
    if (hosting.hasNextPage) void hosting.fetchNextPage();
    else if (going.hasNextPage) void going.fetchNextPage();
  };

  const header = (
    <View className="gap-md pb-sm">
      <View className="flex-row gap-sm py-1.5">
        <FilterChip
          label={t('events.mine.upcoming')}
          selected={when === 'upcoming'}
          onPress={() => setWhen('upcoming')}
          testID="mine-upcoming"
        />
        <FilterChip
          label={t('events.mine.past')}
          selected={when === 'past'}
          onPress={() => setWhen('past')}
          testID="mine-past"
        />
      </View>
      {error ? (
        <Notification
          level="error"
          title={
            error.code === 'rate_limited' ? t('rateLimited.title') : t('errors.unreachable.title')
          }
          caption={
            error.code === 'rate_limited' ? t('rateLimited.wait') : t('errors.unreachable.caption')
          }
          action={
            <Button
              variant="secondary"
              size="small"
              label={t('errors.tryAgain')}
              onPress={() => {
                void hosting.refetch();
                void going.refetch();
              }}
            />
          }
          testID="mine-error"
        />
      ) : null}
    </View>
  );

  return (
    <View className="flex-1">
      <FlatList
        testID="my-events-list"
        refreshControl={<RefreshControl {...pull} />}
        data={rows}
        keyExtractor={(row) => row.key}
        ListHeaderComponent={header}
        contentContainerClassName="gap-md px-lg pb-3xl"
        onEndReachedThreshold={0.5}
        onEndReached={loadMore}
        ListEmptyComponent={
          loading && !error ? (
            <EventListSkeleton />
          ) : error ? null : (
            <EmptyState
              title={t('events.mine.emptyTitle')}
              body={t('events.mine.emptyBody')}
              testID="mine-empty"
            >
              <View className="self-stretch">
                <Button
                  variant="module"
                  module="events"
                  size="large"
                  label={t('events.create')}
                  onPress={() => router.push('/events/new')}
                />
              </View>
            </EmptyState>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View className="items-center py-md" style={{ minHeight: MIN_TOUCH_TARGET }}>
              <ActivityIndicator color={colorValue('green-dark')} />
            </View>
          ) : null
        }
        renderItem={({ item }) =>
          item.kind === 'label' ? (
            <Text accessibilityRole="header" className="pt-sm text-label uppercase text-ink-2">
              {item.label}
            </Text>
          ) : (
            <EventCard
              mine
              event={item.event}
              onPress={() => router.push(`/events/${item.event.id}`)}
              onBadgePress={setBadgeOpener}
            />
          )
        }
      />
      <BadgeSheet
        verified
        visible={Boolean(badgeOpener)}
        onClose={() => setBadgeOpener(null)}
        returnFocusTo={badgeOpener ?? undefined}
      />
    </View>
  );
}
