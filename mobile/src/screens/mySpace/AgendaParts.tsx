import { useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import type { SparkEvent } from '../../api/events';
import { Badge, type BadgeKind } from '../../components/Badge';
import { TextLink } from '../../components/TextLink';
import { resolveLocale } from '../../i18n';
import { MIN_TOUCH_TARGET } from '../../theme/a11y';
import { formatTime } from '../events/format';
import { titleText } from '../events/presenters';
import {
  AGENDA_ZONE,
  agendaKind,
  type AgendaKind,
  dayDots,
  dayHeader,
  dayFilterAnnouncement,
  type DayGroup,
  monthHeader,
  stripCellLabel,
  stripCellParts,
} from './agenda';
import { Card } from './parts';
import { agendaLoadedUntil, type useAgenda } from './queries';

/** Role badge of an outing (design 2.1, 2.3). */
export function roleBadge(event: SparkEvent, t: TFunction): { kind: BadgeKind; label: string } {
  if (event.status === 'cancelled')
    return { kind: 'badge-neutral', label: t('mySpace.agenda.cancelled') };
  if (event.viewer.role === 'host') return { kind: 'badge-green', label: t('mySpace.role.host') };
  if (event.viewer.role === 'participant')
    return { kind: 'badge-sky', label: t('mySpace.role.going') };
  return { kind: 'badge-sky', label: t('mySpace.role.view') };
}

const BAR: Record<AgendaKind, string> = {
  mine: 'bg-green',
  circle: 'bg-sky',
  cancelled: 'bg-ink-3',
};

/**
 * Agenda row (design 2.3): time, 4 px colour bar, title and sub-line, role badge; ≥ 56 px.
 * Cancelled: title struck through in Ink 3 and « Annulée » (AC-1.5). Opens the detail (AC-1.4).
 */
export function AgendaRow({ event }: { event: SparkEvent }) {
  const { t } = useTranslation();
  const router = useRouter();
  const kind = agendaKind(event);
  const badge = roleBadge(event, t);
  const title = titleText(event, t);
  const time = event.starts_at ? formatTime(event.starts_at, event.time_zone || AGENDA_ZONE) : '';
  const sub =
    kind === 'cancelled' && event.viewer.role !== 'host'
      ? t('mySpace.agenda.cancelledBy')
      : kind === 'circle'
        ? t('mySpace.agenda.circleOnly')
        : (event.area?.label ?? '');
  return (
    <Pressable
      testID={`agenda-row-${event.id}`}
      accessibilityRole="link"
      accessibilityLabel={[time, title, sub, badge.label].filter(Boolean).join(', ')}
      onPress={() => router.push(`/events/${event.id}`)}
      className="min-h-[56px] flex-row items-center gap-sm px-lg py-sm"
    >
      <Text className="w-11 text-[13px] font-medium text-ink">{time}</Text>
      <View
        className={`w-1 self-stretch rounded-pill ${BAR[kind]}`}
        accessible={false}
        importantForAccessibility="no"
      />
      <View className="flex-1">
        <Text
          numberOfLines={2}
          className={`text-body font-medium ${kind === 'cancelled' ? 'text-ink-3 line-through' : 'text-ink'}`}
        >
          {title}
        </Text>
        {sub ? <Text className="text-caption text-ink-2">{sub}</Text> : null}
      </View>
      <Badge kind={badge.kind} label={badge.label} />
    </Pressable>
  );
}

/**
 * The day-grouped list (design 2.3): day headers (level-3 headings so screen readers jump day
 * by day), month headers in the long list. Its own Surface card, or `bare` inside the Agenda card.
 */
export function DayList({
  groups,
  today,
  withMonths = false,
  bare = false,
}: {
  groups: DayGroup[];
  today: string;
  withMonths?: boolean;
  bare?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const Wrapper = bare ? View : Card;
  return (
    <Wrapper testID="agenda-list">
      {groups.map((group, index) => {
        const previous = groups[index - 1];
        const newMonth =
          withMonths && previous && previous.day.slice(0, 7) !== group.day.slice(0, 7);
        return (
          <View key={group.day} testID={`agenda-day-${group.day}`}>
            {index > 0 ? <View className="h-[0.5px] bg-border-soft" /> : null}
            {newMonth ? (
              <Text accessibilityRole="header" className="px-lg pt-md text-h3 text-ink">
                {monthHeader(group.day, locale)}
              </Text>
            ) : null}
            <Text
              accessibilityRole="header"
              className={`px-lg pt-md text-caption font-medium ${
                group.day === today ? 'text-lavender-dark' : 'text-ink-2'
              }`}
            >
              {dayHeader(group.day, today, locale, t)}
            </Text>
            {group.events.map((event, row) => (
              <Fragment key={event.id}>
                {row > 0 ? <View className="mx-lg h-[0.5px] bg-border-soft" /> : null}
                <AgendaRow event={event} />
              </Fragment>
            ))}
          </View>
        );
      })}
    </Wrapper>
  );
}

/**
 * The list filtered to the tapped day (AC-1.3b, design 2.3): that day's outings, or
 * « Rien de prévu ce jour-là » with a quiet « Trouver une sortie ». Announced to VoiceOver
 * (« 2 sorties le mercredi 7 octobre ») since the screen itself doesn't move.
 */
export function DayFilterResult({
  day,
  events,
  today,
  bare = false,
}: {
  day: string;
  events: SparkEvent[];
  today: string;
  bare?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const locale = resolveLocale(i18n.language);
  const announcement = dayFilterAnnouncement(day, events.length, locale, t);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(announcement);
  }, [announcement]);

  if (events.length) return <DayList groups={[{ day, events }]} today={today} bare={bare} />;
  const empty = (
    <View testID="agenda-day-empty" className="items-center gap-xs px-lg pb-sm pt-lg">
      <Text className="text-center text-body text-ink-2">{t('mySpace.agenda.nothingThatDay')}</Text>
      <TextLink quiet label={t('mySpace.agenda.findOuting')} onPress={() => router.navigate('/')} />
    </View>
  );
  return bare ? empty : <Card>{empty}</Card>;
}

const DOT: Record<AgendaKind, string> = {
  mine: 'bg-green-dark',
  circle: 'bg-sky-dark',
  cancelled: 'border border-ink-3',
};

/**
 * Week strip (design 2.3): 7 days rolling from today, dots (max 3), swipe for ±7 days (never
 * before today). From accessibility text sizes it scrolls sideways with 64 px cells.
 */
export function WeekStrip({
  days,
  today,
  byDay,
  selected,
  onSelect,
  week,
  onWeekChange,
  inCard = false,
}: {
  days: string[];
  today: string;
  byDay: Map<string, SparkEvent[]>;
  selected: string | null;
  onSelect: (day: string) => void;
  week: number;
  onWeekChange: (week: number) => void;
  /** Inside the Agenda card (Today): no frame of its own. */
  inCard?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const { fontScale } = useWindowDimensions();
  const large = fontScale >= 1.5;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderRelease: (_, g) => {
          if (g.dx < -40) onWeekChange(week + 1);
          else if (g.dx > 40 && week > 0) onWeekChange(week - 1);
        },
      }),
    [week, onWeekChange],
  );

  const actions = [
    { name: 'nextWeek', label: t('mySpace.agenda.nextWeek') },
    ...(week > 0 ? [{ name: 'previousWeek', label: t('mySpace.agenda.previousWeek') }] : []),
  ];

  const cells = days.map((day) => {
    const events = byDay.get(day) ?? [];
    const { weekday, number } = stripCellParts(day, locale);
    const isToday = day === today;
    const isSelected = day === selected;
    const box = isSelected
      ? 'bg-lavender'
      : isToday
        ? 'bg-lavender-light border-[1.5px] border-lavender-dark'
        : '';
    return (
      <Pressable
        key={day}
        testID={`strip-day-${day}`}
        accessibilityRole="button"
        accessibilityLabel={stripCellLabel(day, today, events, locale, t)}
        accessibilityState={{ selected: isSelected }}
        accessibilityActions={actions}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'nextWeek') onWeekChange(week + 1);
          if (e.nativeEvent.actionName === 'previousWeek') onWeekChange(Math.max(0, week - 1));
        }}
        onPress={() => onSelect(day)}
        className={`items-center justify-center gap-xs rounded-md py-xs ${box} ${large ? '' : 'flex-1'}`}
        style={{ minHeight: 60, minWidth: large ? 64 : MIN_TOUCH_TARGET }}
      >
        {large ? (
          <>
            <Text className="text-[15px] font-medium text-ink">{number}</Text>
            <Text className="text-center text-[11px] text-ink-2">{weekday}</Text>
          </>
        ) : (
          <>
            <Text className="text-[11px] text-ink-2">{weekday}</Text>
            <Text className="text-[15px] font-medium text-ink">{number}</Text>
          </>
        )}
        <View
          className="h-1.5 flex-row gap-0.5"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          {dayDots(events).map((kind, index) => (
            <View key={index} className={`h-1.5 w-1.5 rounded-full ${DOT[kind]}`} />
          ))}
        </View>
      </Pressable>
    );
  });

  return (
    <View
      {...pan.panHandlers}
      testID="week-strip"
      accessibilityRole="list"
      accessibilityLabel={t('mySpace.agenda.stripLabel')}
      accessibilityHint={t('mySpace.agenda.stripHint')}
      className={inCard ? 'p-sm' : 'rounded-lg border-[0.5px] border-border-soft bg-surface p-sm'}
    >
      {large ? (
        <ScrollView horizontal contentContainerClassName="gap-xs">
          {cells}
        </ScrollView>
      ) : (
        <View className="flex-row gap-xs">{cells}</View>
      )}
    </View>
  );
}

/** Outings by Paris day, for the strip. */
export function eventsByDay(groups: DayGroup[]): Map<string, SparkEvent[]> {
  return new Map(groups.map((group) => [group.day, group.events]));
}

/**
 * Tap a day = filter (AC-1.3b): no day selected by default; tapping a day selects it, tapping
 * it again clears it. A day past the loaded pages loads them (`waiting` meanwhile).
 */
export function useDayFilter(agenda: ReturnType<typeof useAgenda>) {
  const [selected, setSelected] = useState<string | null>(null);
  const until = agendaLoadedUntil(agenda.data);
  const waiting =
    selected !== null && agenda.hasNextPage && (until === undefined || selected > until);
  const { isFetchingNextPage, isError, fetchNextPage } = agenda;
  useEffect(() => {
    if (waiting && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [waiting, isFetchingNextPage, isError, fetchNextPage]);
  const toggle = useCallback(
    (day: string) => setSelected((current) => (current === day ? null : day)),
    [],
  );
  const clear = useCallback(() => setSelected(null), []);
  return { selected, waiting, toggle, clear };
}
