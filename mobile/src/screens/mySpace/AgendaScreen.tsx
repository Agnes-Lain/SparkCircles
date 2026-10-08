import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header } from '../../components/Header';
import { TextLink } from '../../components/TextLink';
import { colorValue } from '../../theme/colors';
import { useBack } from '../auth/useBack';
import { groupByDay, stripDays, todayInZone } from './agenda';
import { DayFilterResult, DayList, eventsByDay, useDayFilter, WeekStrip } from './AgendaParts';
import { BlockError, BlockSkeleton } from './parts';
import { agendaEvents, useAgenda } from './queries';

/** How close to the bottom (px) the next 30 days start loading. */
const LOAD_AHEAD = 400;
/** Rows loaded at least before waiting for a scroll. */
const MIN_ROWS = 10;

/**
 * Full Agenda (design my-space 2.3): the week strip pinned at the top, every hosted, joined
 * and circle outing by day with month headers, loading 30 days a page while scrolling, and
 * « C'est tout pour l'instant » at the end. No past outings (AC-1.6).
 */
export function AgendaScreen() {
  const { t } = useTranslation();
  const back = useBack('/my-space');
  const agenda = useAgenda();
  const today = todayInZone();
  const [week, setWeek] = useState(0);
  // AC-1.3b: tap a day = filter, as on Today; the list never scrolls to it.
  const { selected, waiting, toggle, clear } = useDayFilter(agenda);
  const { height } = useWindowDimensions();

  const all = useMemo(() => agendaEvents(agenda.data), [agenda.data]);
  const groups = useMemo(() => groupByDay(all), [all]);
  const byDay = useMemo(() => eventsByDay(groups), [groups]);

  // While a day is selected, only that day's pages load (useDayFilter), not the endless list.
  const loadMore = () => {
    if (!selected && agenda.hasNextPage && !agenda.isFetchingNextPage && !agenda.isError)
      void agenda.fetchNextPage();
  };

  // A short first page can't scroll: keep loading until a screenful of rows or the end.
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = agenda;
  useEffect(() => {
    if (all.length < MIN_ROWS && hasNextPage && !isFetchingNextPage && !isError)
      void fetchNextPage();
  }, [all.length, hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1" testID="agenda-screen">
      <View className="gap-md px-lg pb-md pt-lg">
        <Header title={t('mySpace.agenda.title')} onBack={back} />
        <WeekStrip
          days={stripDays(today, week)}
          today={today}
          byDay={byDay}
          selected={selected}
          onSelect={toggle}
          week={week}
          onWeekChange={(next) => {
            setWeek(next);
            // The strip may move past what is loaded: load the next pages for its dots.
            if (next > week) loadMore();
          }}
        />
        <View className="flex-row items-center justify-between gap-md">
          <Text className="flex-1 text-caption text-ink-2">{t('mySpace.agenda.legend')}</Text>
          {selected ? (
            <TextLink
              quiet
              label={t('mySpace.agenda.allDays')}
              onPress={clear}
              testID="agenda-all-days"
            />
          ) : null}
        </View>
      </View>
      <ScrollView
        contentContainerClassName="gap-lg px-lg pb-3xl"
        scrollEventThrottle={200}
        onContentSizeChange={(_, contentHeight) => {
          if (contentHeight < height) loadMore();
        }}
        onScroll={({ nativeEvent: n }) => {
          if (n.contentOffset.y + n.layoutMeasurement.height >= n.contentSize.height - LOAD_AHEAD)
            loadMore();
        }}
      >
        {agenda.isPending ? (
          <BlockSkeleton testID="agenda-screen-loading" />
        ) : agenda.isError && !agenda.data ? (
          <BlockError announce onRetry={() => void agenda.refetch()} testID="agenda-screen-error" />
        ) : selected && !waiting ? (
          <DayFilterResult day={selected} events={byDay.get(selected) ?? []} today={today} />
        ) : (
          <>
            {groups.length && !selected ? (
              <DayList groups={groups} today={today} withMonths />
            ) : null}
            {agenda.isFetchingNextPage ? (
              <ActivityIndicator color={colorValue('lavender-dark')} />
            ) : agenda.isError ? (
              <BlockError onRetry={() => void agenda.fetchNextPage()} testID="agenda-more-error" />
            ) : !agenda.hasNextPage ? (
              <Text className="text-center text-caption text-ink-2" testID="agenda-end">
                {t('mySpace.agenda.end')}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
