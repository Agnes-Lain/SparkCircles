import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header } from '../../components/Header';
import { colorValue } from '../../theme/colors';
import { useBack } from '../auth/useBack';
import { firstDayWithOutings, groupByDay, stripDays, todayInZone } from './agenda';
import { DayList, eventsByDay, WeekStrip } from './AgendaParts';
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
  const [selected, setSelected] = useState<string | null>(null);
  const [nothingThatDay, setNothingThatDay] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const { height } = useWindowDimensions();
  const listY = useRef(0);
  const groupY = useRef(new Map<string, number>());

  const all = useMemo(() => agendaEvents(agenda.data), [agenda.data]);
  const groups = useMemo(() => groupByDay(all), [all]);
  const byDay = useMemo(() => eventsByDay(groups), [groups]);

  const loadMore = () => {
    if (agenda.hasNextPage && !agenda.isFetchingNextPage && !agenda.isError)
      void agenda.fetchNextPage();
  };

  // A short first page can't scroll: keep loading until a screenful of rows or the end.
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = agenda;
  useEffect(() => {
    if (all.length < MIN_ROWS && hasNextPage && !isFetchingNextPage && !isError)
      void fetchNextPage();
  }, [all.length, hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  const select = (day: string) => {
    setSelected(day);
    setNothingThatDay(!byDay.has(day));
    const target = firstDayWithOutings(day, [...byDay.keys()]);
    const y = target ? groupY.current.get(target) : undefined;
    if (y !== undefined) scroll.current?.scrollTo({ y: listY.current + y, animated: false });
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1" testID="agenda-screen">
      <View className="gap-md px-lg pb-md pt-lg">
        <Header title={t('mySpace.agenda.title')} onBack={back} />
        <WeekStrip
          days={stripDays(today, week)}
          today={today}
          byDay={byDay}
          selected={selected}
          onSelect={select}
          week={week}
          onWeekChange={(next) => {
            setWeek(next);
            // The strip may move past what is loaded: load the next pages for its dots.
            if (next > week) loadMore();
          }}
        />
        <Text className="text-caption text-ink-2">{t('mySpace.agenda.legend')}</Text>
        {nothingThatDay ? (
          <Text className="text-caption text-ink-2" accessibilityLiveRegion="polite">
            {t('mySpace.agenda.nothingThatDay')}
          </Text>
        ) : null}
      </View>
      <ScrollView
        ref={scroll}
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
        ) : (
          <>
            {groups.length ? (
              <View
                onLayout={(e) => {
                  listY.current = e.nativeEvent.layout.y;
                }}
              >
                <DayList
                  groups={groups}
                  today={today}
                  withMonths
                  onGroupLayout={(day, y) => groupY.current.set(day, y)}
                />
              </View>
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
