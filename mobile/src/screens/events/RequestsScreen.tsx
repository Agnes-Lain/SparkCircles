import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { Check, CircleAlert, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ApiError } from '../../api/errors';
import { events } from '../../api';
import {
  type DoneRequest,
  eventRequestsKey,
  type HostRequest,
  type SparkEvent,
} from '../../api/events';
import { Avatar } from '../../components/Avatar';
import { Badge, type BadgeKind } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Header } from '../../components/Header';
import { Icon } from '../../components/Icon';
import { Notification } from '../../components/Notification';
import { SectionLabel } from '../../components/SettingsList';
import { Skeleton } from '../../components/Skeleton';
import { StickyBar } from '../../components/StickyBar';
import { TextLink } from '../../components/TextLink';
import { useToast } from '../../components/ToastProvider';
import { shadows } from '../../theme/colors';
import { useBack } from '../auth/useBack';
import { ConfirmSheet } from './ConfirmSheet';
import { isDropoff } from './dropoff';
import { partyText, personName } from './presenters';
import { refreshEvents, storeEvent, useEvent, useEventRequests } from './queries';

/** "Terminées" shows this many rows, then « Voir les N autres » (design 3.5). */
export const DONE_FOLD = 5;

type Sheet = null | { kind: 'decline'; request: HostRequest } | { kind: 'acceptAll' };

/** "Envoyée il y a 2 h" / "Envoyée hier" (requests live 48 hours at most). */
export function sentText(iso: string | null, now: number, t: TFunction): string {
  if (!iso) return '';
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return t('events.dropoff.sentMinutes', { count: Math.max(1, minutes) });
  if (minutes < 24 * 60) return t('events.dropoff.sentHours', { count: Math.floor(minutes / 60) });
  return t('events.dropoff.sentYesterday');
}

/** Can "J'accepte tout" be offered? 2 requests or more, and they all fit (AC-17.20). */
export function allFit(requests: HostRequest[], placesLeft: number): boolean {
  return requests.length >= 2 && requests.reduce((sum, r) => sum + r.places, 0) <= placesLeft;
}

/**
 * The host's request list (design 3.5, AC-17.15 to AC-17.20, AC-17.23): oldest first (the
 * acceptance order); "J'accepte" in one tap, "Je décline" after one confirmation,
 * "J'accepte tout" only when everything fits. A request that doesn't fit says how many
 * places are left and offers to raise them. Phone numbers never appear here.
 */
export function RequestsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const back = useBack(`/events/${id}`);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const event = useEvent(id ?? '');
  const list = useEventRequests(id ?? '');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [failed, setFailed] = useState(false);
  const [now] = useState(() => Date.now());
  const [showAllDone, setShowAllDone] = useState(false);

  const after = (updated: SparkEvent) => {
    storeEvent(queryClient, updated);
    void queryClient.invalidateQueries({ queryKey: eventRequestsKey(id!) });
  };
  const onError = (error: ApiError) => {
    setSheet(null);
    // A refusal (not enough places, expired, closed, frozen): the list shows the real state.
    if (error.status === 409) {
      setFailed(false);
      refreshEvents(queryClient, id!);
      void queryClient.invalidateQueries({ queryKey: eventRequestsKey(id!) });
    } else {
      setFailed(true);
    }
  };

  const accept = useMutation<{ event: SparkEvent }, ApiError, HostRequest>({
    mutationFn: (request) => events().acceptRequest(id!, request.id),
    onSuccess: (data, request) => {
      setFailed(false);
      after(data.event);
      showToast(t('events.dropoff.accepted', { count: request.places }));
    },
    onError,
  });
  const decline = useMutation<{ event: SparkEvent }, ApiError, HostRequest>({
    mutationFn: (request) => events().declineRequest(id!, request.id),
    onSuccess: (data) => {
      setFailed(false);
      setSheet(null);
      after(data.event);
      showToast(t('events.dropoff.declined'));
    },
    onError,
  });
  const acceptAll = useMutation<
    { accepted: number; closed: number; event: SparkEvent },
    ApiError,
    number
  >({
    mutationFn: () => events().acceptAll(id!),
    onSuccess: (data, asked) => {
      setFailed(false);
      setSheet(null);
      after(data.event);
      showToast(
        data.closed > 0
          ? t('events.dropoff.acceptAllPartial', { count: data.accepted })
          : t('events.dropoff.accepted', { count: asked }),
      );
    },
    onError,
  });

  const header = <Header title={t('events.dropoff.requestsTitle')} onBack={back} />;

  if (!list.data) {
    return (
      <SafeAreaView edges={['top', 'bottom']} className="flex-1" testID="requests-screen">
        <View className="gap-xl px-lg pt-lg">
          {header}
          {list.error ? (
            <Notification
              level="error"
              title={t('errors.unreachable.title')}
              caption={t('errors.unreachable.caption')}
              action={
                <Button
                  variant="secondary"
                  size="small"
                  label={t('errors.tryAgain')}
                  onPress={() => void list.refetch()}
                />
              }
              testID="requests-error"
            />
          ) : (
            <View
              className="gap-md"
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={t('events.dropoff.loading')}
              testID="requests-loading"
            >
              <Skeleton height={140} roundedClassName="rounded-lg" />
              <Skeleton height={140} roundedClassName="rounded-lg" />
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const { requests, done, frozen } = list.data;
  const left = list.data.places_left;
  const dropoff = event.data ? isDropoff(event.data) : false;
  const asked = requests.reduce((sum, request) => sum + request.places, 0);
  const canAcceptAll = !frozen && allFit(requests, left);
  const busy = accept.isPending || decline.isPending || acceptAll.isPending;

  return (
    <SafeAreaView edges={['top']} className="flex-1" testID="requests-screen">
      <ScrollView contentContainerClassName="gap-xl px-lg pb-3xl pt-lg">
        {header}
        {failed ? (
          <Notification
            level="error"
            title={t('errors.unreachable.title')}
            caption={t('errors.unreachable.caption')}
            testID="requests-action-error"
          />
        ) : null}
        {frozen ? (
          <Notification
            level="reminder"
            title={t('events.dropoff.frozenTitle')}
            caption={t('events.dropoff.frozenBody')}
            testID="requests-frozen"
          />
        ) : null}

        {requests.length ? (
          <View className="gap-md">
            <View className="gap-xs">
              <Text
                accessibilityRole="header"
                accessibilityLiveRegion="polite"
                className="text-h3 text-ink"
                testID="requests-count"
              >
                {t('events.dropoff.waiting', { count: requests.length })}
              </Text>
              <Text className="text-caption text-ink-2" testID="requests-caption">
                {requests.length >= 2 && !allFit(requests, left)
                  ? t('events.dropoff.cannotAcceptAll')
                  : t('events.dropoff.listCaption', {
                      count: asked,
                      remaining: t('events.dropoff.placesRemaining', { count: left }),
                    })}
              </Text>
            </View>
            {requests.map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                left={left}
                now={now}
                dropoff={dropoff}
                disabled={frozen || busy}
                accepting={accept.isPending && accept.variables?.id === request.id}
                onAccept={() => accept.mutate(request)}
                onDecline={() => setSheet({ kind: 'decline', request })}
                onRaise={() => router.push(`/events/${id}/edit`)}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            emoji="📬"
            title={t('events.dropoff.emptyTitle')}
            body={t('events.dropoff.emptyBody')}
            testID="requests-empty"
          />
        )}

        {done.length ? (
          <View className="gap-sm" testID="requests-done">
            <SectionLabel>{t('events.dropoff.doneTitle')}</SectionLabel>
            {(showAllDone ? done : done.slice(0, DONE_FOLD)).map((item) => (
              <DoneRow key={item.id} item={item} />
            ))}
            {!showAllDone && done.length > DONE_FOLD ? (
              <View className="items-start">
                <TextLink
                  quiet
                  label={t('events.dropoff.doneMore', { count: done.length - DONE_FOLD })}
                  onPress={() => setShowAllDone(true)}
                  testID="requests-done-more"
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {canAcceptAll ? (
        <StickyBar>
          <Button
            size="large"
            label={t('events.dropoff.acceptAll')}
            disabled={busy}
            onPress={() => setSheet({ kind: 'acceptAll' })}
            testID="accept-all"
          />
        </StickyBar>
      ) : null}

      <ConfirmSheet
        visible={sheet?.kind === 'decline'}
        onClose={() => setSheet(null)}
        title={t('events.dropoff.declineTitle', {
          name: sheet?.kind === 'decline' ? personName(sheet.request, t) : '',
        })}
        body={t('events.dropoff.declineBody')}
        primary={{
          label: t('events.dropoff.keepRequest'),
          onPress: () => setSheet(null),
          testID: 'keep-request',
        }}
        secondary={{
          label: t('events.dropoff.decline'),
          onPress: () => sheet?.kind === 'decline' && decline.mutate(sheet.request),
          loading: decline.isPending,
          testID: 'confirm-decline',
        }}
        testID="decline-sheet"
      />
      <ConfirmSheet
        visible={sheet?.kind === 'acceptAll'}
        onClose={() => setSheet(null)}
        title={t('events.dropoff.acceptAllTitle', { count: requests.length })}
        body={
          dropoff
            ? t('events.dropoff.acceptAllBody', { asked, left })
            : t('events.dropoff.acceptAllBodyStandard', { asked, left })
        }
        primary={{
          label: t('events.dropoff.acceptAll'),
          onPress: () => acceptAll.mutate(asked),
          loading: acceptAll.isPending,
          testID: 'confirm-accept-all',
        }}
        secondary={{ label: t('events.dropoff.notNow'), onPress: () => setSheet(null) }}
        testID="accept-all-sheet"
      />
    </SafeAreaView>
  );
}

function RequestRow({
  request,
  left,
  now,
  dropoff,
  disabled,
  accepting,
  onAccept,
  onDecline,
  onRaise,
}: {
  request: HostRequest;
  left: number;
  now: number;
  dropoff: boolean;
  disabled: boolean;
  accepting: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onRaise: () => void;
}) {
  const { t } = useTranslation();
  const name = personName(request, t);
  const tooMany = request.places > left;
  const party = partyText(request.adults, request.children, t);
  return (
    <View
      testID={`request-${request.id}`}
      className="gap-md rounded-lg border-[0.5px] border-border-soft bg-surface p-lg"
      style={{ boxShadow: shadows.card }}
    >
      <View accessible className="flex-row items-start gap-md">
        <Avatar name={request.former_member ? '?' : name} seed={request.id} size="md" />
        <View className="flex-1 gap-xs">
          <View className="flex-row flex-wrap items-center gap-sm">
            <Text className="text-body font-medium text-ink">{name}</Text>
            {request.verified ? (
              <Badge kind="badge-green" label={t('events.badge.verified')} />
            ) : null}
          </View>
          <Text className="text-caption text-ink-2">
            {request.extra
              ? t('events.dropoff.rowExtra', { party, count: request.places })
              : t('events.dropoff.rowPlaces', { party, count: request.places })}
          </Text>
          <Text className="text-caption text-ink-3">{sentText(request.requested_at, now, t)}</Text>
          {dropoff ? (
            <View className="flex-row items-center gap-xs">
              <Icon icon={Lock} size={14} color="ink-2" />
              <Text className="flex-1 text-caption text-ink-2">
                {t('events.dropoff.emergencyAfterAccept')}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      {tooMany ? (
        <View
          accessible
          accessibilityRole="alert"
          className="flex-row items-center gap-xs"
          testID={`request-not-enough-${request.id}`}
        >
          <Icon icon={CircleAlert} size={14} color="error-dark" />
          <Text className="flex-1 text-caption text-error-dark">
            {t('events.dropoff.notEnough', { count: left })}
          </Text>
        </View>
      ) : null}
      <View className="flex-row gap-sm">
        <View className="flex-1">
          <Button
            variant="secondary"
            icon={Check}
            label={t('events.dropoff.accept')}
            disabled={disabled || tooMany}
            loading={accepting}
            onPress={onAccept}
            testID={`accept-${request.id}`}
          />
        </View>
        <View className="flex-1">
          <Button
            variant="ghost"
            label={t('events.dropoff.decline')}
            disabled={disabled}
            onPress={onDecline}
            testID={`decline-${request.id}`}
          />
        </View>
      </View>
      {tooMany ? (
        <View className="items-start">
          <TextLink
            quiet
            label={t('events.dropoff.raisePlaces')}
            onPress={onRaise}
            testID={`raise-${request.id}`}
          />
        </View>
      ) : null}
    </View>
  );
}

/** The "Terminées" badge of a decided request (design 3.5). */
export function doneLabel(item: DoneRequest, t: TFunction): { label: string; kind: BadgeKind } {
  const neutral = (label: string) => ({ label, kind: 'badge-neutral' as BadgeKind });
  switch (item.status) {
    case 'accepted':
      return {
        label: t('events.dropoff.doneAccepted', { count: item.places }),
        kind: 'badge-green',
      };
    case 'declined':
      return neutral(t('events.dropoff.doneDeclined'));
    case 'withdrawn':
      return neutral(t('events.dropoff.doneWithdrawn'));
    case 'expired':
      return neutral(t('events.dropoff.doneExpired'));
    default:
      if (item.closed_reason === 'verification')
        return neutral(t('events.dropoff.doneVerification'));
      if (item.closed_reason === 'cancelled') return neutral(t('events.dropoff.doneCancelled'));
      return neutral(t('events.dropoff.doneFull'));
  }
}

/** "Terminées": one line per decided request, a neutral badge (not tappable in v1). */
function DoneRow({ item }: { item: DoneRequest }) {
  const { t } = useTranslation();
  const look = doneLabel(item, t);
  return (
    <View
      accessible
      className="flex-row items-center justify-between gap-sm"
      style={{ minHeight: 44 }}
      testID={`done-${item.id}`}
    >
      <Text className="flex-1 text-body text-ink">{personName(item, t)}</Text>
      <Badge kind={look.kind} label={look.label} />
    </View>
  );
}
