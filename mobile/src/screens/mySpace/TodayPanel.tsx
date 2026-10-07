import { useRouter } from 'expo-router';
import { Calendar, ChevronRight, Clock, MapPin, ShieldCheck } from 'lucide-react-native';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import type { MyCircleItem } from '../../api/circles';
import type { SparkEvent } from '../../api/events';
import type { Me } from '../../api/types';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { IconSquare } from '../../components/IconSquare';
import { resolveLocale } from '../../i18n';
import { formatDayMonth } from '../../i18n/format';
import { shadows } from '../../theme/colors';
import { ownerVerificationState } from '../account/verification';
import { useMyCircles } from '../circles/queries';
import { clockTime } from '../events/format';
import { titleText, whenText } from '../events/presenters';
import { useMyEvents } from '../events/queries';
import {
  agendaKind,
  eventDay,
  firstDayWithOutings,
  groupByDay,
  inlineGroups,
  nextOuting,
  stripDays,
} from './agenda';
import { AgendaRow, DayList, eventsByDay, roleBadge, WeekStrip } from './AgendaParts';
import { BlockError, BlockHeading, BlockSkeleton, Card, GhostBox, OfflineBanner } from './parts';
import { agendaEvents, useAgenda } from './queries';

const DAY_MS = 24 * 60 * 60 * 1000;

export type TodayQueries = ReturnType<typeof useTodayQueries>;

/** The Today blocks' sources (docs/api/my-space.md section 1), each loading on its own. */
export function useTodayQueries() {
  return {
    agenda: useAgenda(),
    hosted: useMyEvents('host', 'upcoming'),
    joined: useMyEvents('participant', 'upcoming'),
    circles: useMyCircles(),
  };
}

/** Refetches every Today source (pull to refresh, focus: AC-3.5). */
export async function refetchToday(queries: TodayQueries) {
  await Promise.all(Object.values(queries).map((query) => query.refetch()));
}

type MemberItem = Extract<MyCircleItem, { state: 'member' }>;

/**
 * « Aujourd'hui » (design my-space 2): next outing, À valider, verification, agenda, Mes
 * cercles, in that order (action > time-critical > information); the welcome card alone for a
 * new parent (4.1), under the verification card when there is one. Blocks load, fail and retry on their own (AC-6.3).
 */
export function TodayPanel({
  me,
  queries,
  today,
  now,
  onScrollTo,
}: {
  me: Me;
  queries: TodayQueries;
  today: string;
  now: Date;
  /** Scrolls the screen to a y inside this panel. */
  onScrollTo: (y: number) => void;
}) {
  const { t } = useTranslation();
  const { agenda, hosted, joined, circles } = queries;
  const agendaY = useRef(0);

  const all = useMemo(() => agendaEvents(agenda.data), [agenda.data]);
  const next = nextOuting(all);
  // AC-1.1 "whatever the date": keep paging until a next outing shows up or the agenda ends.
  const { hasNextPage, isFetchingNextPage, fetchNextPage, isError: agendaFailed } = agenda;
  useEffect(() => {
    if (agenda.data && !next && hasNextPage && !isFetchingNextPage && !agendaFailed)
      void fetchNextPage();
  }, [agenda.data, next, hasNextPage, isFetchingNextPage, fetchNextPage, agendaFailed]);

  const hostedEvents = hosted.data?.pages[0]?.events ?? [];
  const joinedEvents = joined.data?.pages[0]?.events ?? [];
  const items = circles.data?.items ?? [];
  const memberItems = items.filter((item): item is MemberItem => item.state === 'member');

  // AC-3.1, AC-3.2, AC-3.6: counts only where the server gives them to this host or admin.
  const eventApprovals = hostedEvents.filter(
    (event) => event.status === 'published' && (event.pending_requests_count ?? 0) > 0,
  );
  const circleApprovals = memberItems.filter(
    (item) => item.circle.my_role !== 'member' && item.circle.requests_count > 0,
  );
  // AC-3.3: my own requests, a quiet line each.
  const waiting = [
    ...joinedEvents
      .filter((event) => event.viewer.request?.status === 'pending')
      .map((event) => ({ key: `e-${event.id}`, title: titleText(event, t) })),
    ...items
      .filter((item) => item.state === 'pending')
      .map((item) => ({ key: `c-${item.id}`, title: item.circle?.name ?? '' })),
  ];

  const offline = [agenda, hosted, joined, circles].some((query) => query.error?.isOffline);
  const lastUpdate = Math.max(
    ...[agenda, hosted, joined, circles].map((query) => query.dataUpdatedAt || 0),
  );
  const firstFailure = [agenda, hosted, circles].find((query) => query.isError && !query.data);

  const loaded = [agenda, hosted, joined, circles].every((query) => query.isSuccess);
  const isNew =
    loaded &&
    all.length === 0 &&
    !agenda.hasNextPage &&
    memberItems.length === 0 &&
    eventApprovals.length === 0 &&
    circleApprovals.length === 0 &&
    waiting.length === 0;

  const verified = me.verification.verified;

  if (isNew) {
    return (
      <View className="gap-lg" testID="today-panel">
        {offline ? <OfflineBanner time={lastUpdate ? clockTime(lastUpdate) : null} /> : null}
        {/* AC-U.1: an unverified new parent still gets the verification card (with its reason). */}
        <VerificationNote me={me} />
        <WelcomeCard verified={verified} />
      </View>
    );
  }

  return (
    <View className="gap-lg" testID="today-panel">
      {offline ? <OfflineBanner time={lastUpdate ? clockTime(lastUpdate) : null} /> : null}

      {next ? (
        <View className="gap-md">
          <BlockHeading title={t('mySpace.next.title')} />
          <NextOutingCard event={next} today={today} now={now} />
        </View>
      ) : null}

      {hosted.isPending || joined.isPending || circles.isPending ? (
        <BlockSkeleton testID="approve-loading" />
      ) : (hosted.isError && !hosted.data) || (joined.isError && !joined.data) ? (
        <View className="gap-md">
          <BlockHeading title={t('mySpace.approve.title')} />
          <BlockError
            testID="approve-error"
            announce={firstFailure === hosted}
            onRetry={() => {
              void hosted.refetch();
              void joined.refetch();
            }}
          />
        </View>
      ) : (
        <ToApprove events={eventApprovals} circles={circleApprovals} waiting={waiting} />
      )}

      <VerificationNote me={me} />

      <View
        onLayout={(e) => {
          agendaY.current = e.nativeEvent.layout.y;
        }}
      >
        <AgendaBlock
          queries={queries}
          all={all}
          next={next}
          today={today}
          announce={firstFailure === agenda}
          onScrollTo={(y) => onScrollTo(agendaY.current + y)}
          onScrollTop={() => onScrollTo(0)}
        />
      </View>

      <CirclesBlock
        queries={queries}
        memberItems={memberItems}
        circleOutings={all.filter((event) => agendaKind(event) === 'circle').slice(0, 3)}
        verified={verified}
        announce={firstFailure === circles}
      />
    </View>
  );
}

/** « Prochaine sortie » (design 2.1, AC-1.1, AC-1.2). */
function NextOutingCard({ event, today, now }: { event: SparkEvent; today: string; now: Date }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const locale = resolveLocale(i18n.language);
  const starts = event.starts_at ? new Date(event.starts_at).getTime() : Infinity;
  const soon = starts - now.getTime() <= DAY_MS;
  const day = eventDay(event);
  const dateBadge = soon
    ? day === today
      ? t('mySpace.next.today')
      : t('mySpace.next.tomorrow')
    : null;
  const role = roleBadge(event, t);
  const title = titleText(event, t);
  const when = whenText(event, locale, t);
  const place = event.exact_address ?? event.area?.label ?? '';
  const people = event.participants ?? [];
  const families = people.length;
  const label = [
    title,
    dateBadge,
    when,
    event.exact_address ? `${place}, ${t('mySpace.next.exactAddress')}` : place,
    role.label,
    families ? t('mySpace.next.families', { count: families }) : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      testID="next-outing"
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => router.push(`/events/${event.id}`)}
      className={`flex-row overflow-hidden rounded-lg bg-surface ${
        soon ? 'border-2 border-green' : 'border-[0.5px] border-border-soft'
      }`}
      style={{ boxShadow: shadows.card }}
    >
      <View className="w-1 bg-green" accessible={false} importantForAccessibility="no" />
      <View className="flex-1 gap-sm px-lg py-md">
        <View className="flex-row items-center justify-between gap-sm">
          {dateBadge ? (
            <Badge kind="badge-yellow" label={dateBadge} testID="next-outing-soon" />
          ) : (
            <View />
          )}
          <Badge kind={role.kind} label={role.label} />
        </View>
        <Text numberOfLines={2} className="text-h3 text-ink">
          {title}
        </Text>
        <View className="flex-row items-center gap-xs">
          <Icon icon={Calendar} size={16} color="ink-2" />
          <Text className="flex-1 text-body text-ink">{when}</Text>
        </View>
        {place ? (
          <View className="flex-row items-center gap-xs">
            <Icon icon={MapPin} size={14} color="ink-2" />
            <Text className="flex-1 text-caption text-ink-2">
              {place}
              {event.exact_address ? ` · ${t('mySpace.next.exactAddress')}` : ''}
            </Text>
          </View>
        ) : null}
        {families ? (
          <View className="flex-row items-center gap-sm">
            <View className="flex-row">
              {people.slice(0, 3).map((person, index) => (
                <View key={index} className={index > 0 ? '-ml-1.5' : ''}>
                  <Avatar
                    size="sm"
                    name={person.first_name ?? '?'}
                    seed={`${person.first_name ?? ''}${index}`}
                  />
                </View>
              ))}
            </View>
            <Text className="text-caption text-ink-2">
              {t('mySpace.next.families', { count: families })}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/** « À valider » (design 2.2, AC-3.1 to AC-3.4): hidden when nothing waits. */
function ToApprove({
  events,
  circles,
  waiting,
}: {
  events: SparkEvent[];
  circles: MemberItem[];
  waiting: { key: string; title: string }[];
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const rows = [
    ...events.map((event) => {
      const count = event.pending_requests_count ?? 0;
      const title = titleText(event, t);
      return {
        key: `e-${event.id}`,
        title,
        sub: t('mySpace.approve.eventRequests'),
        count,
        label: t('mySpace.approve.eventA11y', { title, count }),
        onPress: () => router.push(`/events/${event.id}/requests`),
      };
    }),
    ...circles.map((item) => ({
      key: `c-${item.circle.id}`,
      title: item.circle.name,
      sub: t('mySpace.approve.circleRequests'),
      count: item.circle.requests_count,
      label: t('mySpace.approve.circleA11y', {
        title: item.circle.name,
        count: item.circle.requests_count,
      }),
      onPress: () => router.push(`/circles/${item.circle.id}/members`),
    })),
  ];
  if (rows.length === 0 && waiting.length === 0) return null;

  const waitingLines = (
    <View className="gap-xs" testID="waiting">
      {waiting.slice(0, 2).map((item) => (
        <View key={item.key} className="flex-row items-center gap-xs">
          <Icon icon={Clock} size={14} color="ink-2" />
          <Text className="flex-1 text-caption text-ink-2">
            {t('mySpace.approve.waiting', { title: item.title })}
          </Text>
        </View>
      ))}
      {waiting.length > 2 ? (
        <Text className="pl-lg text-caption text-ink-2">
          {t('mySpace.approve.waitingMore', { count: waiting.length - 2 })}
        </Text>
      ) : null}
    </View>
  );

  if (rows.length === 0) return waitingLines;

  return (
    <View className="gap-md" testID="to-approve">
      <BlockHeading title={t('mySpace.approve.title')} />
      <Card>
        <View className="px-lg">
          {rows.map((row, index) => (
            <Fragment key={row.key}>
              {index > 0 ? <View className="h-[0.5px] bg-border-soft" /> : null}
              <Pressable
                testID={`approve-${row.key}`}
                accessibilityRole="button"
                accessibilityLabel={row.label}
                onPress={row.onPress}
                className="min-h-[52px] flex-row items-center gap-md py-sm"
              >
                <IconSquare icon={Clock} />
                <View className="flex-1">
                  <Text numberOfLines={2} className="text-body text-ink">
                    {row.title}
                  </Text>
                  <Text className="text-caption text-ink-3">{row.sub}</Text>
                </View>
                <Badge kind="badge-lavender" label={String(row.count)} />
                <Icon icon={ChevronRight} color="ink-3" />
              </Pressable>
            </Fragment>
          ))}
        </View>
      </Card>
      {waiting.length ? waitingLines : null}
    </View>
  );
}

/** Verification card (design 2.4, AC-4.1 to AC-4.5): never mentions a criminal record. */
function VerificationNote({ me }: { me: Me }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const v = me.verification;
  const state = ownerVerificationState(v);
  if (v.renewal?.status === 'pending' || state === 'pending') {
    return (
      <View
        testID="verify-note-pending"
        accessible
        className="flex-row items-center gap-md rounded-lg bg-sky-light px-lg py-md"
      >
        <Icon icon={Clock} size={18} color="sky-dark" />
        <Text className="flex-1 text-body text-ink">{t('mySpace.verify.pending')}</Text>
      </View>
    );
  }
  if (state === 'verified') return null;
  if (state === 'expiresSoon') {
    return (
      <View testID="verify-note-renew" className="gap-md rounded-lg bg-sunny-light px-lg py-md">
        <View className="flex-row items-center gap-md">
          <IconSquare icon={ShieldCheck} tone="verification" />
          <Text className="flex-1 text-note-title text-ink">
            {t('mySpace.verify.renewTitle', {
              date: v.expires_on ? formatDayMonth(v.expires_on, resolveLocale(i18n.language)) : '',
            })}
          </Text>
        </View>
        <View className="items-start">
          <Button
            variant="secondary"
            size="small"
            label={t('mySpace.verify.renew')}
            onPress={() => router.push('/verify')}
            testID="verify-renew"
          />
        </View>
      </View>
    );
  }
  const reason = state === 'rejected' || state === 'revoked' ? v.rejection?.message : null;
  return (
    <View testID="verify-note" className="gap-md rounded-lg bg-sunny-light px-lg py-md">
      <View className="flex-row items-start gap-md">
        <IconSquare icon={ShieldCheck} tone="verification" />
        <View className="flex-1 gap-xs">
          <Text accessibilityRole="header" className="text-note-title text-ink">
            {t('mySpace.verify.title')}
          </Text>
          <Text className="text-body text-ink-2">{reason || t('mySpace.verify.body')}</Text>
        </View>
      </View>
      <View className="items-start">
        <Button
          size="small"
          label={state === 'rejected' ? t('mySpace.verify.retry') : t('mySpace.verify.cta')}
          onPress={() => router.push('/verify')}
          testID="verify-start"
        />
      </View>
    </View>
  );
}

/** Agenda (design 2.3): week strip + up to 5 day groups, then the full Agenda screen. */
function AgendaBlock({
  queries,
  all,
  next,
  today,
  announce,
  onScrollTo,
  onScrollTop,
}: {
  queries: TodayQueries;
  all: SparkEvent[];
  next: SparkEvent | undefined;
  today: string;
  announce: boolean;
  onScrollTo: (y: number) => void;
  onScrollTop: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { agenda } = queries;
  const [week, setWeek] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [nothingThatDay, setNothingThatDay] = useState(false);
  const listY = useRef(0);
  const groupY = useRef(new Map<string, number>());

  const heading = (
    <BlockHeading
      title={t('mySpace.agenda.title')}
      link={{
        label: t('mySpace.agenda.seeAll'),
        onPress: () => router.push('/agenda'),
        testID: 'agenda-see-all',
      }}
    />
  );

  if (agenda.isPending) return <BlockSkeleton strip testID="agenda-loading" />;
  if (agenda.isError && !agenda.data)
    return (
      <View className="gap-md">
        {heading}
        <BlockError
          testID="agenda-error"
          announce={announce}
          onRetry={() => void agenda.refetch()}
        />
      </View>
    );

  const listed = all.filter((event) => event !== next);
  const { groups, truncated } = inlineGroups(groupByDay(listed));
  const byDay = eventsByDay(groupByDay(all));

  const select = (day: string) => {
    setSelected(day);
    const target = firstDayWithOutings(day, [...byDay.keys()]);
    setNothingThatDay(!byDay.has(day));
    if (!target) return;
    if (next && target === eventDay(next) && !groups.some((group) => group.day === target))
      return onScrollTop();
    const y = groupY.current.get(target);
    if (y !== undefined) onScrollTo(listY.current + y);
  };

  return (
    <View className="gap-md" testID="agenda-block">
      {heading}
      <WeekStrip
        days={stripDays(today, week)}
        today={today}
        byDay={byDay}
        selected={selected}
        onSelect={select}
        week={week}
        onWeekChange={setWeek}
      />
      {nothingThatDay ? (
        <Text className="text-caption text-ink-2" accessibilityLiveRegion="polite">
          {t('mySpace.agenda.nothingThatDay')}
        </Text>
      ) : null}
      {all.length === 0 ? (
        <GhostBox
          testID="agenda-empty"
          icon={Calendar}
          text={t('mySpace.agenda.empty')}
          link={{ label: t('mySpace.agenda.findOuting'), onPress: () => router.navigate('/') }}
        />
      ) : groups.length ? (
        <View
          onLayout={(e) => {
            listY.current = e.nativeEvent.layout.y;
          }}
        >
          <DayList
            groups={groups}
            today={today}
            onGroupLayout={(day, y) => groupY.current.set(day, y)}
          />
        </View>
      ) : null}
      {truncated || agenda.hasNextPage ? (
        <Button
          variant="ghost"
          label={t('mySpace.agenda.seeFull')}
          onPress={() => router.push('/agenda')}
          testID="agenda-see-full"
        />
      ) : null}
      {agenda.isError && agenda.data ? (
        <Text className="text-caption text-ink-3">
          {t('mySpace.offline.updatedAt', { time: clockTime(agenda.dataUpdatedAt) })}
        </Text>
      ) : null}
    </View>
  );
}

/** « Mes cercles » + « Sorties de vos cercles » (design 2.5, AC-5.1 to AC-5.4). */
function CirclesBlock({
  queries,
  memberItems,
  circleOutings,
  verified,
  announce,
}: {
  queries: TodayQueries;
  memberItems: MemberItem[];
  circleOutings: SparkEvent[];
  verified: boolean;
  announce: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { circles } = queries;
  const heading = (
    <BlockHeading
      title={t('mySpace.circles.title')}
      link={
        memberItems.length
          ? {
              label: t('mySpace.circles.all'),
              onPress: () => router.navigate('/community'),
              testID: 'circles-all',
            }
          : undefined
      }
    />
  );
  if (circles.isPending) return <BlockSkeleton testID="circles-loading" />;
  if (circles.isError && !circles.data)
    return (
      <View className="gap-md">
        {heading}
        <BlockError
          testID="circles-error"
          announce={announce}
          onRetry={() => void circles.refetch()}
        />
      </View>
    );

  return (
    <View className="gap-md" testID="circles-block">
      {heading}
      {memberItems.length === 0 ? (
        <GhostBox
          testID="circles-empty"
          text={t('mySpace.circles.none')}
          link={{
            label: verified ? t('mySpace.circles.joinOrCreate') : t('mySpace.circles.join'),
            onPress: () => router.navigate('/community?tab=find'),
          }}
        />
      ) : (
        memberItems.slice(0, 3).map((item) => <CircleCard key={item.id} item={item} />)
      )}
      {circleOutings.length ? (
        <View className="gap-sm" testID="circle-outings">
          <Text accessibilityRole="header" className="text-h3 text-ink">
            {t('mySpace.circles.outings')}
          </Text>
          <Card>
            {circleOutings.map((event, index) => (
              <Fragment key={event.id}>
                {index > 0 ? <View className="mx-lg h-[0.5px] bg-border-soft" /> : null}
                <AgendaRow event={event} />
              </Fragment>
            ))}
          </Card>
        </View>
      ) : null}
    </View>
  );
}

function CircleCard({ item }: { item: MemberItem }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { circle } = item;
  const families = t('mySpace.circles.families', { count: circle.families_count });
  return (
    <Pressable
      testID={`my-space-circle-${circle.id}`}
      accessibilityRole="link"
      accessibilityLabel={[
        circle.name,
        circle.area.label,
        families,
        circle.new ? t('mySpace.circles.new') : null,
      ]
        .filter(Boolean)
        .join(', ')}
      onPress={() => router.push(`/circles/${circle.id}`)}
      className="flex-row overflow-hidden rounded-lg border-[0.5px] border-border-soft bg-surface"
      style={{ boxShadow: shadows.card }}
    >
      <View className="w-1 bg-sky" accessible={false} importantForAccessibility="no" />
      <View className="flex-1 gap-xs px-lg py-md">
        <View className="flex-row items-center gap-sm">
          <Text numberOfLines={1} className="flex-1 text-h3 text-ink">
            {circle.name}
          </Text>
          {circle.new ? (
            <View className="flex-row items-center gap-xs">
              <View className="h-2 w-2 rounded-full bg-sky-dark" />
              <Text className="text-caption font-medium text-sky-dark">
                {t('mySpace.circles.new')}
              </Text>
            </View>
          ) : null}
        </View>
        <Text className="text-caption text-ink-2">{`${circle.area.label} · ${families}`}</Text>
      </View>
    </Pressable>
  );
}

/**
 * New-parent welcome (design 4.1 and PM decisions 2026-10-07): the Lavender card holds only
 * the emoji, title and body; below it, equal-weight feature entry points 16 px apart: Mint
 * module CTA, the outline « Organiser une sortie » (or « Vérifier mon identité »), Sky module
 * CTA. No green Primary here.
 */
function WelcomeCard({ verified }: { verified: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View className="gap-lg" testID="welcome">
      <View className="items-center gap-md rounded-xl bg-lavender-light px-lg py-xl">
        <Text className="text-[32px]" accessible={false} importantForAccessibility="no">
          🦄
        </Text>
        <Text accessibilityRole="header" className="text-center text-h2 text-ink">
          {t('mySpace.welcome.title')}
        </Text>
        <Text className="text-center text-body text-ink-2">{t('mySpace.welcome.body')}</Text>
      </View>
      <View className="gap-lg">
        <Button
          variant="module"
          module="events"
          size="large"
          label={t('mySpace.welcome.findOuting')}
          onPress={() => router.navigate('/')}
          testID="welcome-find"
        />
        {/* Unverified: the verification card above carries « Vérifier mon identité ». */}
        {verified ? (
          <Button
            variant="ghost"
            size="large"
            label={t('mySpace.welcome.hostOuting')}
            onPress={() => router.push('/events/new')}
            testID="welcome-host"
          />
        ) : null}
        <Button
          variant="module"
          module="community"
          size="large"
          label={t('mySpace.welcome.joinCircle')}
          onPress={() => router.navigate('/community?tab=find')}
          testID="welcome-join"
        />
      </View>
    </View>
  );
}
