import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header } from '../../components/Header';
import { colorValue } from '../../theme/colors';
import { useBack } from '../auth/useBack';
import { addDays } from '../events/format';
import { groupByDay, todayInZone, windowSize } from './agenda';
import { AgendaWindow, DayFilterResult, DayList, eventsByDay, useDayFilter } from './AgendaParts';
import { BlockError, BlockSkeleton, Card } from './parts';
import { agendaEvents, agendaLoadedUntil, useAgenda } from './queries';

/** How close to the bottom (px) the next 30 days start loading. */
const LOAD_AHEAD = 400;
/** Rows loaded at least before waiting for a scroll. */
const MIN_ROWS = 10;

/**
 * Full Agenda (design my-space 2.3, « Agenda week navigation »): the 5-day window pinned at the
 * top of one Agenda card, every hosted, joined and circle outing by day with month headers, loading 30 days a page while scrolling, and
 * « C'est tout pour l'instant » at the end. No past outings (AC-1.6).
 */
export function AgendaScreen() {
  const { t } = useTranslation();
  const back = useBack('/my-space');
  const agenda = useAgenda();
  const today = todayInZone();
  const { height, fontScale } = useWindowDimensions();
  // Design « Agenda week navigation »: a 5-day window (3 at accessibility sizes) from today.
  const size = windowSize(fontScale);
  const [offset, setOffset] = useState(0);
  // AC-1.3b: tap a day = filter, as on Today; the list never scrolls to it.
  const { selected, waiting, toggle, clear } = useDayFilter(agenda);

  const all = useMemo(() => agendaEvents(agenda.data), [agenda.data]);
  const groups = useMemo(() => groupByDay(all), [all]);
  const byDay = useMemo(() => eventsByDay(groups), [groups]);

  // While a day is selected, only that day's pages load (useDayFilter), not the endless list.
  const loadMore = () => {
    if (!selected && agenda.hasNextPage && !agenda.isFetchingNextPage && !agenda.isError)
      void agenda.fetchNextPage();
  };

  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = agenda;

  // The window may move past what is loaded: load the next pages for its dots (even while a
  // day is selected, unlike the endless list).
  const windowEnd = addDays(today, offset + size - 1);
  const until = agendaLoadedUntil(agenda.data);
  const windowAhead = until !== undefined && windowEnd > until;
  useEffect(() => {
    if (windowAhead && hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [windowAhead, hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  // A short first page can't scroll: keep loading until a screenful of rows or the end.
  useEffect(() => {
    if (all.length < MIN_ROWS && hasNextPage && !isFetchingNextPage && !isError)
      void fetchNextPage();
  }, [all.length, hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1" testID="agenda-screen">
      <View className="gap-md px-lg pb-md pt-lg">
        <Header title={t('mySpace.agenda.title')} onBack={back} />
        <Text className="text-caption text-ink-2">{t('mySpace.agenda.legend')}</Text>
      </View>
      {/* One Agenda card: the window stays pinned, the list scrolls under it. */}
      <View className="flex-1 px-lg pb-md">
        <Card testID="agenda-card" className="flex-1 overflow-hidden">
          <AgendaWindow
            today={today}
            offset={offset}
            size={size}
            byDay={byDay}
            selected={selected}
            onSelect={toggle}
            onClear={clear}
            onOffsetChange={setOffset}
          />
          <View className="h-[0.5px] bg-border-soft" />
          <ScrollView
            contentContainerClassName="gap-lg pb-lg"
            scrollEventThrottle={200}
            onContentSizeChange={(_, contentHeight) => {
              if (contentHeight < height) loadMore();
            }}
            onScroll={({ nativeEvent: n }) => {
              if (
                n.contentOffset.y + n.layoutMeasurement.height >=
                n.contentSize.height - LOAD_AHEAD
              )
                loadMore();
            }}
          >
            {agenda.isPending ? (
              <View className="p-md">
                <BlockSkeleton testID="agenda-screen-loading" />
              </View>
            ) : agenda.isError && !agenda.data ? (
              <View className="p-md">
                <BlockError
                  announce
                  onRetry={() => void agenda.refetch()}
                  testID="agenda-screen-error"
                />
              </View>
            ) : selected && !waiting ? (
              <DayFilterResult
                day={selected}
                events={byDay.get(selected) ?? []}
                today={today}
                bare
              />
            ) : (
              <>
                {groups.length && !selected ? (
                  <DayList groups={groups} today={today} withMonths bare />
                ) : null}
                {agenda.isFetchingNextPage ? (
                  <ActivityIndicator color={colorValue('lavender-dark')} />
                ) : agenda.isError ? (
                  <View className="px-md">
                    <BlockError
                      onRetry={() => void agenda.fetchNextPage()}
                      testID="agenda-more-error"
                    />
                  </View>
                ) : !agenda.hasNextPage ? (
                  <Text className="text-center text-caption text-ink-2" testID="agenda-end">
                    {t('mySpace.agenda.end')}
                  </Text>
                ) : null}
              </>
            )}
          </ScrollView>
        </Card>
      </View>
    </SafeAreaView>
  );
}
