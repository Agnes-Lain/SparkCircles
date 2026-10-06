import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft,
  Clock,
  Ellipsis,
  Lock,
  MapPin,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react-native';
import { type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { events } from '../../api';
import type { ApiError } from '../../api/errors';
import type { SparkEvent } from '../../api/events';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { CategoryPill } from '../../components/CategoryPill';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/IconButton';
import { IconSquare } from '../../components/IconSquare';
import { LanguageTag } from '../../components/LanguageTag';
import { Notification } from '../../components/Notification';
import { SectionLabel } from '../../components/SettingsList';
import { Skeleton } from '../../components/Skeleton';
import { StickyBar } from '../../components/StickyBar';
import { SuccessCheckmark } from '../../components/SuccessCheckmark';
import { TextLink } from '../../components/TextLink';
import { useToast } from '../../components/ToastProvider';
import { resolveLocale } from '../../i18n';
import { MIN_TOUCH_TARGET } from '../../theme/a11y';
import { shadows } from '../../theme/colors';
import { BadgeSheet } from '../account/BadgeSheet';
import { MessageScreen } from '../auth/layouts';
import { useBack } from '../auth/useBack';
import { CATEGORY_ICON } from './categories';
import { ConfirmSheet } from './ConfirmSheet';
import { Confetti } from './Confetti';
import { clockTime, formatKm, formatLongDay, formatTime } from './format';
import { JoinSheet } from './JoinSheet';
import { hasEnded, partyText, personName, placesText, statusBadge, titleText } from './presenters';
import { forgetParticipation, freshEvent, refreshEvents, storeEvent, useEvent } from './queries';
import { type ClosedReason, closedReason, isRefusal, refusalText } from './refusals';
import { ReportSheet } from './ReportSheet';

type Sheet =
  null | 'join' | 'change' | 'leave' | 'restricted' | 'report' | 'cancel' | 'delete' | 'publish';

function Card({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View
      testID={testID}
      className="gap-sm rounded-lg border-[0.5px] border-border-soft bg-surface p-lg"
      style={{ boxShadow: shadows.card }}
    >
      {children}
    </View>
  );
}

function DetailSkeleton() {
  const { t } = useTranslation();
  return (
    <View
      testID="event-loading"
      className="gap-lg px-lg pt-md"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('events.loadingEvent')}
    >
      <Skeleton width="45%" height={12} />
      <Skeleton width="85%" height={28} />
      <Skeleton width={110} height={28} roundedClassName="rounded-full" />
      <Skeleton width={90} height={32} />
      <Skeleton height={88} roundedClassName="rounded-lg" />
      <Skeleton height={72} roundedClassName="rounded-lg" />
      <Skeleton height={48} roundedClassName="rounded-lg" />
    </View>
  );
}

/**
 * E2 / E4 / E9 Event detail (AC-1.4, 1.8, 2.4, 4.1, 4.3, 5.x, 6.x, 7.x, 8.x, 9.1). What is
 * shown comes from the server's audience: the exact address and the participants only for
 * participants and the host. The sticky bar holds one primary action at a time (AC-5.7).
 */
export function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const router = useRouter();
  const back = useBack('/');
  const queryClient = useQueryClient();
  const { showToast, takeCelebration } = useToast();
  const query = useEvent(id ?? '');
  const [sheet, setSheetState] = useState<Sheet>(null);
  // A new key per opening, so the join and report sheets start fresh each time.
  const [sheetKey, setSheetKey] = useState(0);
  const setSheet = (next: Sheet) => {
    if (next) setSheetKey((k) => k + 1);
    setSheetState(next);
  };
  const [badgeOpen, setBadgeOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const [celebrate] = useState(takeCelebration);
  const badgeRef = useRef<View>(null);
  const moreRef = useRef<View>(null);

  const close = () => setSheet(null);
  const seeOthers = () => router.replace('/');

  const leave = useMutation<void, ApiError, void>({
    mutationFn: () => events().leave(id!),
    onSuccess: () => {
      close();
      forgetParticipation(queryClient, id!);
      showToast(t('events.detail.left'));
    },
    onError: (error) => {
      close();
      // Not a participant any more (left elsewhere): the address goes too (BUG-1, BUG-3).
      if (error.code === 'not_joined') forgetParticipation(queryClient, id!);
      else onRefused(error);
    },
  });
  const cancel = useMutation<{ event: SparkEvent }, ApiError, void>({
    mutationFn: () => events().cancel(id!),
    onSuccess: (data) => {
      close();
      storeEvent(queryClient, data.event);
      showToast(t('events.detail.cancelled'));
    },
    onError: (error) => {
      close();
      onRefused(error);
    },
  });
  const remove = useMutation<void, ApiError, void>({
    mutationFn: () => events().remove(id!),
    onSuccess: () => {
      close();
      refreshEvents(queryClient);
      queryClient.removeQueries({ queryKey: ['events', 'detail', id] });
      back();
    },
    onError: (error) => {
      close();
      onRefused(error);
    },
  });
  const publish = useMutation<{ event: SparkEvent }, ApiError, void>({
    mutationFn: () => events().publish(id!),
    onSuccess: (data) => {
      close();
      storeEvent(queryClient, data.event);
      showToast(t('events.detail.online'));
    },
    onError: (error) => {
      close();
      // BUG-8: a draft saved with missing fields: the form shows what is missing.
      if (error.code === 'validation_failed') router.push(`/events/${id}/edit?check=1`);
      else onRefused(error);
    },
  });

  // BUG-3: a refusal because the event changed meanwhile shows its real state.
  const [refused, setRefused] = useState<ClosedReason | null>(null);
  function onRefused(error: ApiError) {
    setRefused(null);
    if (!isRefusal(error)) return;
    void freshEvent(queryClient, id!).then((fresh) =>
      setRefused(closedReason(fresh, { editing: fresh?.viewer.role === 'host' })),
    );
  }

  // A refusal closes the sheet and shows on the page.
  const failed = leave.error ?? cancel.error ?? remove.error ?? publish.error;
  const actionError =
    failed &&
    !isRefusal(failed) &&
    failed.code !== 'not_joined' &&
    failed.code !== 'validation_failed'
      ? failed
      : null;

  const event = query.data;

  if (!event) {
    if (query.error?.code === 'not_found' || query.error?.code === 'forbidden') {
      return (
        <MessageScreen
          testID="event-not-found"
          onBack={back}
          icon={MapPin}
          title={t('events.detail.notFoundTitle')}
          body={t('events.detail.notFoundBody')}
        >
          <Button size="large" label={t('events.detail.seeOthers')} onPress={seeOthers} />
        </MessageScreen>
      );
    }
    return (
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="-ml-1 flex-row px-sm">
          <IconButton icon={ChevronLeft} accessibilityLabel={t('common.back')} onPress={back} />
        </View>
        {query.error ? (
          <View className="px-lg pt-md">
            <Notification
              level="error"
              title={
                query.error.code === 'rate_limited'
                  ? t('rateLimited.title')
                  : t('errors.unreachable.title')
              }
              caption={
                query.error.code === 'rate_limited'
                  ? t('rateLimited.wait')
                  : t('errors.unreachable.caption')
              }
              action={
                <Button
                  variant="secondary"
                  size="small"
                  label={t('errors.tryAgain')}
                  onPress={() => void query.refetch()}
                />
              }
              testID="event-error"
            />
          </View>
        ) : (
          <DetailSkeleton />
        )}
      </SafeAreaView>
    );
  }

  const role = event.viewer.role;
  const isHost = role === 'host';
  const joined = event.viewer.joined;
  const ended = hasEnded(event);
  const host = event.host;
  const status = statusBadge(event, t, isHost);
  const detailBadge =
    status && (isHost || ['onHold', 'cancelled', 'ended'].includes(status.key)) ? status : null;
  const offline = Boolean(query.error?.isOffline);
  const date = event.starts_at ? formatLongDay(event.starts_at, event.time_zone, locale) : null;
  const title = titleText(event, t);
  const participants = event.participants ?? [];

  const verify = () => {
    close();
    router.push('/verify');
  };

  // ---- Notices at the top (E9) ----
  let notice: ReactNode = null;
  if (event.status === 'suspended') {
    notice = isHost ? (
      <Notification
        level="reminder"
        title={t('events.detail.hostOnHoldTitle')}
        caption={t('events.detail.hostOnHoldBody')}
        testID="notice-host-on-hold"
      />
    ) : (
      <Notification
        level="reminder"
        title={t('events.detail.onHoldTitle')}
        caption={t('events.detail.onHoldBody')}
        testID="notice-on-hold"
      />
    );
  } else if (event.status === 'cancelled') {
    notice = isHost ? (
      <Notification
        level="reminder"
        title={t('events.detail.hostCancelledTitle')}
        caption={t('events.detail.hostCancelledBody')}
        testID="notice-host-cancelled"
      />
    ) : (
      <Notification
        level="reminder"
        title={t('events.detail.cancelledTitle')}
        caption={t('events.detail.cancelledBody')}
        testID="notice-cancelled"
      />
    );
  }

  // ---- The sticky bar (one primary at a time, AC-5.7) ----
  let bar: ReactNode = null;
  let barCaption: string | undefined;
  if (isHost) {
    if (event.status === 'draft') {
      barCaption = t('events.detail.draftCaption');
      bar = (
        <>
          <Button
            size="large"
            label={t('events.detail.publish')}
            onPress={() => setSheet('publish')}
            testID="host-publish"
          />
          <Button
            variant="ghost"
            label={t('events.detail.editShort')}
            onPress={() => router.push(`/events/${event.id}/edit`)}
            testID="host-edit"
          />
          <DestructiveLink
            label={t('events.detail.deleteDraft')}
            onPress={() => setSheet('delete')}
            testID="host-delete"
          />
        </>
      );
    } else if (event.status === 'suspended' && !ended) {
      barCaption = t('events.detail.hostOnHoldCaption');
      bar = (
        <>
          <Button size="large" label={t('events.detail.verifyCta')} onPress={verify} />
          <DestructiveLink
            label={t('events.detail.cancel')}
            onPress={() => setSheet('cancel')}
            testID="host-cancel"
          />
        </>
      );
    } else if (event.status === 'cancelled') {
      bar = (
        <Button
          size="large"
          label={t('events.detail.createNew')}
          onPress={() => router.push('/events/new')}
        />
      );
    } else if (!ended) {
      bar = (
        <>
          <Button
            size="large"
            label={t('events.detail.edit')}
            onPress={() => router.push(`/events/${event.id}/edit`)}
            testID="host-edit"
          />
          <DestructiveLink
            label={t('events.detail.cancel')}
            onPress={() => setSheet('cancel')}
            testID="host-cancel"
          />
        </>
      );
    }
  } else if (event.status === 'cancelled') {
    bar = <Button size="large" label={t('events.detail.seeOthers')} onPress={seeOthers} />;
  } else if (ended) {
    bar = null;
  } else if (joined && event.my_participation) {
    const going = (
      <View className="items-center">
        <Badge
          kind="badge-green"
          label={t('events.detail.going', { count: event.my_participation.places })}
          testID="going-badge"
        />
      </View>
    );
    bar =
      event.status === 'suspended' ? (
        <>
          {going}
          <Button
            variant="ghost"
            label={t('events.detail.leave')}
            onPress={() => setSheet('leave')}
            testID="leave"
          />
        </>
      ) : (
        <>
          {going}
          <Button
            variant="ghost"
            label={t('events.detail.changePlaces')}
            onPress={() => setSheet('change')}
            testID="change-places"
          />
          <View className="items-center">
            <TextLink
              quiet
              label={t('events.detail.leave')}
              onPress={() => setSheet('leave')}
              testID="leave"
            />
          </View>
        </>
      );
  } else if (event.status === 'suspended') {
    barCaption = t('events.detail.notOpenCaption');
    bar = <Button size="large" disabled label={t('events.detail.notOpen')} onPress={() => {}} />;
  } else if (event.full || event.viewer.join_blocker === 'full') {
    barCaption = t('events.detail.fullCaption');
    bar = (
      <Button
        size="large"
        disabled
        label={t('events.detail.full')}
        onPress={() => {}}
        testID="join-full-cta"
      />
    );
  } else if (event.viewer.join_blocker === 'verification_required') {
    barCaption = t('events.detail.verifiedOnlyCaption');
    bar = (
      <Button
        size="large"
        label={t('events.detail.verifyCta')}
        onPress={() => setSheet('restricted')}
        testID="verify-to-join"
      />
    );
  } else if (event.viewer.can_join) {
    barCaption = t('events.detail.joinCaption');
    bar = (
      <Button
        size="large"
        label={t('events.detail.join')}
        onPress={() => setSheet('join')}
        testID="join"
      />
    );
  } else {
    barCaption = t('events.detail.started');
  }

  const total = event.places.total ?? 0;
  const placesLine = isHost
    ? t('events.detail.hostPlaces', {
        taken: event.places.taken,
        total,
        left: event.places.left,
      })
    : placesText(event, t);
  const full = event.full || event.places.left <= 0;
  const filled = total > 0 ? event.places.taken / total : 0;

  return (
    <SafeAreaView edges={['top']} className="flex-1" testID="event-detail">
      <View className="flex-row items-center justify-between px-sm">
        <IconButton icon={ChevronLeft} accessibilityLabel={t('common.back')} onPress={back} />
        {/* Nobody reports their own event: the host gets no "⋯" (design E7). */}
        {isHost ? null : (
          <Pressable
            ref={moreRef}
            testID="more-options"
            accessibilityRole="button"
            accessibilityLabel={t('events.detail.more')}
            onPress={() => setSheet('report')}
            className="items-center justify-center"
            style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET }}
          >
            <Icon icon={Ellipsis} size={22} />
          </Pressable>
        )}
      </View>
      <ScrollView contentContainerClassName="gap-lg px-lg pb-3xl pt-sm">
        {offline ? (
          <Notification
            level="error"
            title={t('events.detail.offlineTitle')}
            caption={t('events.detail.offlineBody', { time: clockTime(query.dataUpdatedAt) })}
            testID="event-offline"
          />
        ) : null}
        {refused && refused !== 'unavailable' ? (
          <Notification level="error" {...refusalText(refused, t, isHost)} testID="event-refused" />
        ) : null}
        {actionError ? (
          <Notification
            level="error"
            title={
              actionError.code === 'rate_limited'
                ? t('rateLimited.title')
                : actionError.code === 'verification_required'
                  ? t('events.form.draftStaysTitle')
                  : t('errors.unreachable.title')
            }
            caption={
              actionError.code === 'rate_limited'
                ? t('rateLimited.wait')
                : actionError.code === 'verification_required'
                  ? t('events.form.draftStaysBody')
                  : actionError.isOffline
                    ? t('errors.unreachable.caption')
                    : actionError.message
            }
            action={
              actionError.code === 'verification_required' ? (
                <Button
                  variant="secondary"
                  size="small"
                  label={t('events.detail.verifyCta')}
                  onPress={verify}
                />
              ) : undefined
            }
            testID="event-action-error"
          />
        ) : null}
        {notice}
        {celebrate ? (
          <View className="items-center">
            <SuccessCheckmark />
          </View>
        ) : null}

        <View className="gap-sm">
          <View className="flex-row items-center gap-xs">
            <Icon icon={Users} size={14} color="ink-2" />
            <Text className="text-caption font-medium text-ink-2">{t('events.type')}</Text>
          </View>
          <Text accessibilityRole="header" className="text-h1 text-ink">
            {title}
          </Text>
          <View className="flex-row flex-wrap items-center gap-sm">
            {event.category ? (
              <CategoryPill
                category={event.category}
                label={t(`events.categories.${event.category}`)}
                icon={CATEGORY_ICON[event.category]}
              />
            ) : null}
            <LanguageTag language={event.language} testID="event-language" />
            {detailBadge ? (
              <View className="flex-row items-center gap-xs">
                {detailBadge.key === 'onHold' ? (
                  <Icon icon={Clock} size={14} color="sunny-dark" />
                ) : null}
                <Badge kind={detailBadge.kind} label={detailBadge.label} testID="status-badge" />
              </View>
            ) : null}
          </View>
        </View>

        {event.starts_at && event.ends_at && date ? (
          <View accessible className="gap-xs">
            <Text className="text-data text-ink">
              {formatTime(event.starts_at, event.time_zone)}
            </Text>
            <Text className="text-body font-medium text-ink">
              {t('events.detail.until', {
                date,
                time: formatTime(event.ends_at, event.time_zone),
              })}
            </Text>
          </View>
        ) : (
          <Text className="text-body font-medium text-ink-2">{t('events.noDate')}</Text>
        )}

        <Card testID="where">
          <SectionLabel>{t('events.detail.where')}</SectionLabel>
          {event.exact_address ? (
            <View className="flex-row items-start gap-md">
              <IconSquare icon={MapPin} tone="verification" />
              <View className="flex-1 gap-xs">
                <Text className="text-h3 text-ink" testID="exact-address">
                  {event.exact_address}
                </Text>
                <Text className="text-caption text-ink-3">
                  {isHost
                    ? t('events.detail.hostExactCaption', {
                        area: event.area?.label ?? t('events.noArea'),
                      })
                    : t('events.detail.exactCaption')}
                </Text>
              </View>
            </View>
          ) : (
            <View className="gap-sm">
              <View className="flex-row items-start gap-md">
                <IconSquare icon={MapPin} />
                <View className="flex-1">
                  <Text className="text-h3 text-ink">
                    {event.area?.label ?? t('events.noArea')}
                  </Text>
                  {event.distance_km !== null ? (
                    <Text className="text-caption text-ink-2">
                      {t('events.area.distanceOnly', {
                        distance: formatKm(event.distance_km, locale),
                      })}
                    </Text>
                  ) : null}
                </View>
              </View>
              {event.status !== 'cancelled' ? (
                <View className="flex-row items-center gap-sm rounded-md bg-shell p-md">
                  <Icon icon={Lock} size={16} color="ink-2" />
                  <Text className="flex-1 text-caption text-ink-2">
                    {t('events.detail.lockNote')}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </Card>

        {isHost || host ? (
          <Card testID="host-card">
            <View className="flex-row items-center gap-md">
              <Avatar
                name={
                  isHost ? t('events.person.you') : host!.former_member ? '?' : personName(host!, t)
                }
                seed={host?.id ?? 'host'}
                size="md"
              />
              <View className="flex-1">
                <Text className="text-h3 text-ink">
                  {isHost ? t('events.person.you') : personName(host!, t)}
                </Text>
                <Text className="text-caption text-ink-2">
                  {isHost ? t('events.detail.youHosting') : t('events.detail.hosting')}
                </Text>
              </View>
              {!isHost && host && !host.former_member && host.verified ? (
                <Badge
                  ref={badgeRef}
                  kind="badge-green"
                  label={t('events.badge.verified')}
                  accessibilityLabel={t('events.badge.verifiedA11y')}
                  onPress={() => setBadgeOpen(true)}
                  testID="host-badge"
                />
              ) : null}
            </View>
          </Card>
        ) : null}

        <View className="flex-row items-center gap-sm">
          <Icon
            icon={event.join_rule === 'verified_only' ? ShieldCheck : Users}
            size={18}
            color={event.join_rule === 'verified_only' ? 'green-dark' : 'ink-2'}
          />
          <Text
            className={`text-body ${
              event.join_rule === 'verified_only' ? 'font-medium text-green-dark' : 'text-ink-2'
            }`}
          >
            {event.join_rule === 'verified_only'
              ? t('events.detail.ruleVerified')
              : t('events.detail.ruleAnyone')}
          </Text>
        </View>

        <View className="gap-xs" testID="places">
          <View className="flex-row items-center gap-xs">
            <Icon icon={Users} size={16} color="ink-2" />
            <Text className="flex-1 text-body font-medium text-ink">{placesLine}</Text>
            {!isHost && status && ['almostFull', 'full'].includes(status.key) ? (
              <Badge kind={status.kind} label={status.label} />
            ) : null}
          </View>
          <View
            className="h-1.5 overflow-hidden rounded-pill bg-border-soft"
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            <View
              className={`h-1.5 rounded-pill ${full ? 'bg-ink-3' : 'bg-green'}`}
              style={{ width: `${Math.round((full ? 1 : filled) * 100)}%` }}
            />
          </View>
        </View>

        {event.description ? <Text className="text-body text-ink">{event.description}</Text> : null}

        {event.age_min !== null || event.age_max !== null ? (
          <Text className="text-body text-ink-2" testID="event-ages">
            {event.age_min !== null && event.age_max !== null
              ? t('events.detail.ages', { min: event.age_min, max: event.age_max })
              : event.age_min !== null
                ? t('events.detail.agesFrom', { min: event.age_min })
                : t('events.detail.agesUpTo', { max: event.age_max })}
          </Text>
        ) : null}

        {event.tags.length ? (
          <View className="flex-row flex-wrap gap-sm">
            {event.tags.map((tag) => (
              <Pressable
                key={tag}
                testID={`tag-${tag}`}
                accessibilityRole="link"
                accessibilityLabel={t('events.detail.searchTag', { tag })}
                onPress={() => router.navigate({ pathname: '/', params: { tag } })}
                className="justify-center"
                style={{ minHeight: MIN_TOUCH_TARGET }}
              >
                <View className="rounded-pill bg-shell px-2.5 py-1">
                  <Text className="text-[11px] font-medium text-ink-2">#{tag}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View className="gap-sm" testID="who">
          <SectionLabel>
            {isHost ? t('events.detail.participants') : t('events.detail.whoComing')}
          </SectionLabel>
          {event.participants ? (
            <>
              {participants.map((person, index) => (
                <View
                  key={`${person.first_name ?? 'former'}-${index}`}
                  accessible
                  className="flex-row items-center gap-md"
                  testID="participant-row"
                >
                  <Avatar
                    name={person.former_member ? '?' : (person.first_name ?? '?')}
                    seed={`${person.first_name ?? ''}${person.last_name_initial ?? ''}${index}`}
                    size="md"
                  />
                  <View className="flex-1">
                    <Text className="text-body font-medium text-ink">{personName(person, t)}</Text>
                    <Text className="text-caption text-ink-2">
                      {partyText(person.adults, person.children, t)}
                    </Text>
                  </View>
                  {person.former_member ? null : person.verified ? (
                    <Badge kind="badge-green" label={t('events.badge.verified')} />
                  ) : isHost ? (
                    <Badge kind="badge-neutral" label={t('events.badge.notVerified')} />
                  ) : null}
                </View>
              ))}
              {isHost ? (
                <Text className="text-caption text-ink-3">{t('events.detail.ownParty')}</Text>
              ) : null}
            </>
          ) : (
            // Non-participants: the count only, never names or avatars (AC-6.4).
            <Text className="text-body text-ink-2" testID="taken-hidden">
              {t('events.detail.takenHidden', { count: event.places.taken })}
            </Text>
          )}
        </View>
      </ScrollView>

      {bar || barCaption ? <StickyBar caption={barCaption}>{bar}</StickyBar> : null}
      <Confetti burst={burst} />

      <JoinSheet
        key={`join-${sheetKey}`}
        event={event}
        visible={sheet === 'join' || sheet === 'change'}
        change={sheet === 'change'}
        onClose={close}
        onVerify={verify}
        onJoined={(_, places) => {
          const changing = sheet === 'change';
          close();
          if (changing) {
            showToast(t('common.saved'));
          } else {
            showToast(t('events.join.success', { count: places }));
            setBurst((n) => n + 1);
          }
        }}
      />
      <ConfirmSheet
        visible={sheet === 'restricted'}
        onClose={close}
        title={t('events.detail.restrictedTitle')}
        body={t('events.detail.restrictedBody')}
        primary={{
          label: t('events.detail.verifyCta'),
          onPress: verify,
          testID: 'restricted-verify',
        }}
        secondary={{ label: t('events.detail.notNow'), onPress: close }}
        testID="restricted-sheet"
      />
      <ConfirmSheet
        visible={sheet === 'leave'}
        onClose={close}
        title={t('events.detail.leaveTitle')}
        body={
          event.places.left <= 3
            ? `${t('events.detail.leaveBody')} ${t('events.detail.leaveWarning')}`
            : t('events.detail.leaveBody')
        }
        primary={{ label: t('events.detail.keepPlaces'), onPress: close, testID: 'keep-places' }}
        secondary={{
          label: t('events.detail.leave'),
          onPress: () => leave.mutate(),
          loading: leave.isPending,
          testID: 'confirm-leave',
        }}
        testID="leave-sheet"
      />
      <ConfirmSheet
        visible={sheet === 'cancel'}
        onClose={close}
        title={t('events.detail.cancelTitle')}
        body={
          participants.length > 0
            ? t('events.detail.cancelBody', { count: participants.length })
            : t('events.detail.cancelBodyNone')
        }
        primary={{
          label: t('events.detail.cancel'),
          variant: 'destructive',
          icon: X,
          onPress: () => cancel.mutate(),
          loading: cancel.isPending,
          testID: 'confirm-cancel',
        }}
        secondary={{ label: t('events.detail.keepEvent'), onPress: close }}
        testID="cancel-sheet"
      />
      <ConfirmSheet
        visible={sheet === 'delete'}
        onClose={close}
        title={t('events.detail.deleteTitle')}
        body={t('events.detail.deleteBody')}
        primary={{
          label: t('events.detail.deleteConfirm'),
          variant: 'destructive',
          icon: X,
          onPress: () => remove.mutate(),
          loading: remove.isPending,
          testID: 'confirm-delete',
        }}
        secondary={{ label: t('events.detail.keepDraft'), onPress: close }}
        testID="delete-sheet"
      />
      <ConfirmSheet
        visible={sheet === 'publish'}
        onClose={close}
        title={t('events.form.publishTitle')}
        body={t('events.form.publishBody')}
        primary={{
          label: t('events.form.publishConfirm'),
          onPress: () => publish.mutate(),
          loading: publish.isPending,
          testID: 'confirm-publish',
        }}
        secondary={{ label: t('events.form.keepEditing'), onPress: close }}
        testID="publish-sheet"
      />
      {isHost ? null : (
        <ReportSheet
          key={`report-${sheetKey}`}
          eventId={event.id}
          visible={sheet === 'report'}
          onClose={close}
        />
      )}
      <BadgeSheet
        verified
        visible={badgeOpen}
        onClose={() => setBadgeOpen(false)}
        returnFocusTo={badgeRef}
      />
    </SafeAreaView>
  );
}

function DestructiveLink({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="items-center justify-center"
      style={{ minHeight: MIN_TOUCH_TARGET }}
    >
      <Text className="text-body font-medium text-error-dark underline">{label}</Text>
    </Pressable>
  );
}
