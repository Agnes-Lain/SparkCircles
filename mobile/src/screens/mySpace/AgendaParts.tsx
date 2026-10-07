import { useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PanResponder, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import type { SparkEvent } from '../../api/events';
import { Badge, type BadgeKind } from '../../components/Badge';
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
  type DayGroup,
  monthHeader,
  stripCellLabel,
  stripCellParts,
} from './agenda';
import { Card } from './parts';

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
 * The day-grouped list (design 2.3): one Surface card, day headers (level-3 headings so screen
 * readers jump day by day), month headers in the long list. Reports where each day starts.
 */
export function DayList({
  groups,
  today,
  withMonths = false,
  onGroupLayout,
}: {
  groups: DayGroup[];
  today: string;
  withMonths?: boolean;
  onGroupLayout?: (day: string, y: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  return (
    <Card testID="agenda-list">
      {groups.map((group, index) => {
        const previous = groups[index - 1];
        const newMonth =
          withMonths && previous && previous.day.slice(0, 7) !== group.day.slice(0, 7);
        return (
          <View
            key={group.day}
            testID={`agenda-day-${group.day}`}
            onLayout={(e) => onGroupLayout?.(group.day, e.nativeEvent.layout.y)}
          >
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
    </Card>
  );
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
}: {
  days: string[];
  today: string;
  byDay: Map<string, SparkEvent[]>;
  selected: string | null;
  onSelect: (day: string) => void;
  week: number;
  onWeekChange: (week: number) => void;
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
      className="rounded-lg border-[0.5px] border-border-soft bg-surface p-sm"
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
