import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft,
  Ellipsis,
  Flag,
  Pencil,
  Search,
  Trash2,
  UserMinus,
  UserPlus,
  UserRoundCog,
} from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { circles } from '../../api';
import {
  type CircleMember,
  isMemberCircle,
  type MemberCircle,
  type PublicCircle,
} from '../../api/circles';
import type { ApiError } from '../../api/errors';
import { useIsGuest } from '../../auth/GateContext';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { HeaderIconButton } from '../../components/HeaderIconButton';
import { Icon } from '../../components/Icon';
import { Notification } from '../../components/Notification';
import { RadioRow } from '../../components/RadioRow';
import { Skeleton } from '../../components/Skeleton';
import { SuccessCheckmark } from '../../components/SuccessCheckmark';
import { TextLink } from '../../components/TextLink';
import { useToast } from '../../components/ToastProvider';
import { resolveLocale } from '../../i18n';
import { MIN_TOUCH_TARGET } from '../../theme/a11y';
import { MessageScreen } from '../auth/layouts';
import { useBack } from '../auth/useBack';
import { ConfirmSheet } from '../events/ConfirmSheet';
import { formatShortDay, formatTime } from '../events/format';
import { useGuestAccount } from '../guest/useGuestAccount';
import {
  Card,
  circleStatusError,
  FamiliesLine,
  NeutralLine,
  RoleBadge,
  TypeLine,
  VerifiedBadge,
} from './CircleParts';
import { CircleReportSheet } from './CircleReportSheet';
import { displayName, forgetCircle, refreshCircles, storeCircle, useCircle } from './queries';

/** `/circles/:id`: the member detail (C5), the paused/closed status, or the public page (C9). */
export function CircleScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const back = useBack('/community');
  const query = useCircle(id);
  const circle = query.data;

  if (!circle) {
    if (query.error?.status === 404) {
      // AC-4.6, AC-17.3, AC-17.14: the same page as for an unknown circle (design 9g).
      return (
        <MessageScreen
          testID="circle-unavailable"
          onBack={back}
          illustration={<Text className="text-center text-[32px]">🏡</Text>}
          title={t('circles.detail.unavailableTitle')}
          body={t('circles.detail.unavailableBody')}
        >
          <Button
            size="large"
            icon={Search}
            label={t('circles.detail.findCircle')}
            onPress={() => router.replace('/community?tab=find')}
          />
        </MessageScreen>
      );
    }
    return (
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="flex-row px-lg">
          <HeaderIconButton
            icon={ChevronLeft}
            accessibilityLabel={t('common.back')}
            onPress={back}
          />
        </View>
        <View className="gap-lg px-lg pt-md">
          {query.error ? (
            <Notification
              level="error"
              title={
                query.error.code === 'rate_limited'
                  ? t('rateLimited.title')
                  : t('circles.detail.loadError')
              }
              caption={t('errors.unreachable.caption')}
              action={
                <Button
                  variant="secondary"
                  size="small"
                  label={t('errors.tryAgain')}
                  onPress={() => void query.refetch()}
                />
              }
              testID="circle-error"
            />
          ) : (
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={t('circles.detail.loading')}
              className="gap-lg"
              testID="circle-loading"
            >
              <Skeleton width="70%" height={28} />
              <Skeleton height={88} roundedClassName="rounded-lg" />
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={48} roundedClassName="rounded-lg" />
              ))}
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (circle.audience === 'public') return <PublicCircleView circle={circle} />;
  if (!isMemberCircle(circle)) {
    // AC-7.3, AC-9.3: nothing else is visible.
    return (
      <SafeAreaView edges={['top']} className="flex-1" testID="circle-status">
        <View className="flex-row px-lg">
          <HeaderIconButton
            icon={ChevronLeft}
            accessibilityLabel={t('common.back')}
            onPress={back}
          />
        </View>
        <View className="px-lg pt-md">
          <Card>
            <NeutralLine
              text={
                circle.status === 'suspended'
                  ? t('circles.detail.statusPaused')
                  : t('circles.detail.statusClosed')
              }
            />
          </Card>
        </View>
      </SafeAreaView>
    );
  }
  return <MemberCircleView circle={circle} />;
}

function Header({ onMore, back }: { onMore?: () => void; back: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center justify-between px-lg">
      <HeaderIconButton icon={ChevronLeft} accessibilityLabel={t('common.back')} onPress={back} />
      {onMore ? (
        <HeaderIconButton
          icon={Ellipsis}
          accessibilityLabel={t('circles.detail.more')}
          onPress={onMore}
          testID="circle-more"
        />
      ) : null}
    </View>
  );
}

function SheetAction({
  icon,
  label,
  onPress,
  destructive = false,
  testID,
}: {
  icon: typeof Flag;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="flex-row items-center gap-md"
      style={{ minHeight: MIN_TOUCH_TARGET + 8 }}
    >
      <Icon icon={icon} size={20} color={destructive ? 'error-dark' : 'ink-2'} />
      <Text className={`text-body font-medium ${destructive ? 'text-error-dark' : 'text-ink'}`}>
        {label}
      </Text>
    </Pressable>
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

/** C9 Public circle page (AC-17.5, AC-17.6, AC-17.13; design 9a to 9f). */
function PublicCircleView({ circle }: { circle: PublicCircle }) {
  const { t } = useTranslation();
  const router = useRouter();
  const back = useBack('/community?tab=find');
  const { then } = useLocalSearchParams<{ then?: string }>();
  const guest = useIsGuest();
  const account = useGuestAccount();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [report, setReport] = useState(0);
  const [menu, setMenu] = useState(false);
  const [sent, setSent] = useState(false);
  const ask = useMutation<unknown, ApiError, void>({
    mutationFn: () => circles().askToJoin(circle.id),
    onSuccess: () => {
      setSent(true);
      refreshCircles(queryClient, circle.id);
    },
  });
  const cancel = useMutation<unknown, ApiError, void>({
    mutationFn: () => circles().cancelRequest(circle.id),
    onSuccess: () => {
      showToast(t('circles.requestCancelled'));
      refreshCircles(queryClient, circle.id);
    },
    onError: () => showToast(t('circles.detail.actionError'), 'error'),
  });

  if (sent) {
    return (
      <MessageScreen
        testID="public-sent"
        illustration={<SuccessCheckmark />}
        title={t('circles.join.sentTitle')}
        body={t('circles.join.sentBody')}
      >
        <Button
          size="large"
          label={t('circles.join.seeCircles')}
          onPress={() => router.replace('/community')}
        />
      </MessageScreen>
    );
  }

  const viewer = circle.viewer;
  const blocker = viewer.request_blocker;
  const target = { circle: { id: circle.id } };
  let action: ReactNode;
  if (guest) {
    action = (
      <>
        <Button
          size="large"
          label={t('circles.join.createAccount')}
          onPress={() => account.signUp(target)}
          testID="public-sign-up"
        />
        <Button
          variant="ghost"
          label={t('circles.join.haveAccount')}
          onPress={() => account.logIn(target)}
          testID="public-log-in"
        />
        <Text className="text-center text-caption text-ink-2">
          {t('circles.public.guestCaption')}
        </Text>
      </>
    );
  } else if (viewer.status === 'pending') {
    action = (
      <>
        <Notification
          level="reminder"
          title={t('circles.public.pendingTitle')}
          caption={t('circles.public.pendingBody')}
          testID="public-pending"
        />
        <View className="items-center">
          <TextLink
            quiet
            label={t('circles.public.cancel')}
            onPress={() => cancel.mutate()}
            disabled={cancel.isPending}
            testID="public-cancel"
          />
        </View>
      </>
    );
  } else if (viewer.status === 'member') {
    action = (
      <>
        <Notification
          level="community"
          title={t('circles.public.memberTitle')}
          caption={t('circles.public.memberBody')}
        />
        <Button
          size="large"
          label={t('circles.public.open')}
          onPress={() => void refreshCircles(queryClient, circle.id)}
        />
      </>
    );
  } else if (blocker === 'full' || circle.full || ask.error?.code === 'circle_full') {
    action = (
      <>
        <Notification
          level="reminder"
          title={t('circles.public.fullTitle')}
          caption={t('circles.public.fullBody')}
          testID="public-full"
        />
        <Button size="large" disabled label={t('circles.join.ask')} onPress={() => {}} />
      </>
    );
  } else if (blocker === 'member_limit' || ask.error?.code === 'circle_member_limit') {
    action = (
      <Notification level="reminder" title={t('circles.join.limit')} testID="public-limit" />
    );
  } else {
    action = (
      <>
        {ask.error ? (
          <Notification
            level="error"
            title={
              ask.error.isOffline ? t('circles.join.offline') : t('circles.detail.actionError')
            }
            testID="public-error"
          />
        ) : null}
        <Button
          size="large"
          label={t('circles.join.ask')}
          loading={ask.isPending}
          onPress={() => ask.mutate()}
          testID="public-ask"
        />
      </>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1" testID="public-circle">
      <Header back={back} onMore={guest ? undefined : () => setMenu(true)} />
      <ScrollView contentContainerClassName="gap-lg px-lg pb-3xl pt-sm">
        {then === 'request' && !guest ? (
          <Notification
            level="confirmed"
            title={t('circles.join.readyTitle')}
            caption={t('circles.join.readyBody')}
            testID="public-ready"
          />
        ) : null}
        <View className="flex-row flex-wrap gap-xs">
          <Badge kind="badge-sky" label={t('circles.public.label')} />
          <Badge kind="badge-green" label={t('circles.public.runBy')} />
        </View>
        <Text accessibilityRole="header" className="text-h1 text-ink">
          {circle.name}
        </Text>
        <FamiliesLine count={circle.families_count} area={circle.area.label} />
        {circle.description ? (
          <Card>
            <Text className="text-body text-ink">{circle.description}</Text>
          </Card>
        ) : null}
        {viewer.status === 'none' ? (
          <Text className="text-body text-ink-2">{t('circles.public.note')}</Text>
        ) : null}
        <View className="gap-sm">{action}</View>
      </ScrollView>
      <BottomSheet visible={menu} onClose={() => setMenu(false)} testID="public-menu">
        <SheetAction
          icon={Flag}
          label={t('circles.detail.report')}
          onPress={() => {
            setMenu(false);
            setReport((k) => k + 1);
          }}
          testID="public-report"
        />
      </BottomSheet>
      {report ? (
        <CircleReportSheet key={report} circleId={circle.id} visible onClose={() => setReport(0)} />
      ) : null}
    </SafeAreaView>
  );
}

type Sheet =
  | null
  | { kind: 'menu' }
  | { kind: 'member'; member: CircleMember }
  | { kind: 'remove'; member: CircleMember }
  | { kind: 'promote'; member: CircleMember }
  | { kind: 'leave' }
  | { kind: 'sole' }
  | { kind: 'picker' }
  | { kind: 'delete' };

/** C5 Circle detail for members (AC-2.4, AC-4.1 to AC-4.7, AC-5.x, AC-6.x, AC-7.1, AC-16.4). */
function MemberCircleView({ circle }: { circle: MemberCircle }) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const router = useRouter();
  const back = useBack('/community');
  const { created } = useLocalSearchParams<{ created?: string }>();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [report, setReport] = useState<{
    key: number;
    member?: { id: string; name: string };
  } | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const close = () => setSheet(null);
  const manage = circle.can.manage;

  const onFail = (error: ApiError) => {
    close();
    showToast(
      circleStatusError(error, t) ?? (error.message || t('circles.detail.actionError')),
      'error',
    );
    refreshCircles(queryClient, circle.id);
  };
  const after = { close, onFail };
  const accept = useCircleAction(
    after,
    (request: { id: string; name: string }) => circles().accept(circle.id, request.id),
    (request) => t('circles.detail.joined', { name: request.name }),
  );
  const decline = useCircleAction(
    after,
    (request: { id: string; name: string }) => circles().decline(circle.id, request.id),
    () => t('circles.detail.declined'),
  );
  const remove = useCircleAction(
    after,
    (member: CircleMember) => circles().removeMember(circle.id, member.id),
    (member) => t('circles.sheets.removed', { name: displayName(member) }),
  );
  const promote = useCircleAction(
    after,
    (member: CircleMember) => circles().promote(circle.id, member.id),
    (member) => t('circles.sheets.promoted', { name: displayName(member) }),
  );
  const stepDown = useCircleAction(
    after,
    (_: void) => circles().stepDown(circle.id),
    () => t('circles.detail.steppedDown'),
  );
  const leave = useMutation<void, ApiError, void>({
    mutationFn: () => circles().leave(circle.id),
    onSuccess: () => {
      close();
      forgetCircle(queryClient, circle.id);
      showToast(t('circles.sheets.left'));
      router.replace('/community');
    },
    onError: (error) => {
      if (error.code === 'sole_admin') setSheet({ kind: 'sole' });
      else onFail(error);
    },
  });
  const destroy = useMutation<void, ApiError, void>({
    mutationFn: () => circles().remove(circle.id),
    onSuccess: () => {
      close();
      forgetCircle(queryClient, circle.id);
      showToast(t('circles.sheets.deleted'));
      router.replace('/community');
    },
    onError: onFail,
  });

  const me = circle.members.find((member) => member.me);
  const verifiedMe = me?.verified ?? false;
  const joinedOutings = circle.events.filter((event) => event.joined).length;
  const admins = circle.members.filter((member) => member.role !== 'member').length;
  const candidates = circle.members.filter(
    (member) => !member.me && member.verified && member.role === 'member',
  );
  const next = circle.next_event;

  const primary = circle.admin_rights_paused ? null : circle.can.invite ? (
    <Button
      size="large"
      icon={UserPlus}
      label={t('circles.detail.invite')}
      onPress={() => router.push(`/circles/${circle.id}/invite`)}
      testID="circle-invite"
    />
  ) : (
    <Button
      size="large"
      label={t('circles.detail.suggestOuting')}
      onPress={() => router.push(`/events/new?circle=${circle.id}`)}
      testID="circle-suggest"
    />
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1" testID="circle-detail">
      <Header back={back} onMore={() => setSheet({ kind: 'menu' })} />
      <ScrollView contentContainerClassName="gap-lg px-lg pb-3xl pt-sm">
        <View className="gap-sm">
          <Text accessibilityRole="header" className="text-h1 text-ink">
            {circle.name}
          </Text>
          <FamiliesLine
            count={circle.families_count}
            area={circle.area.label}
            max={circle.max_families}
          />
          <TypeLine visibility={circle.visibility} />
          {circle.description ? (
            <Text className="text-body text-ink-2">{circle.description}</Text>
          ) : null}
        </View>

        {created ? (
          <Notification
            level="confirmed"
            title={t('circles.detail.createdTitle')}
            caption={t('circles.detail.createdBody')}
            testID="circle-created"
          />
        ) : null}
        {circle.admin_rights_paused ? (
          <Notification
            level="reminder"
            title={t('circles.detail.pausedTitle')}
            caption={t('circles.detail.pausedBody')}
            action={
              <Button
                variant="secondary"
                size="small"
                label={t('circles.detail.pausedCta')}
                onPress={() => router.push('/verify')}
              />
            }
            testID="admin-paused"
          />
        ) : null}
        {manage && circle.visibility === 'public' && !circle.discoverable ? (
          <Notification level="reminder" title={t('circles.detail.hiddenFromSearch')} />
        ) : null}

        {primary}

        {manage && circle.requests.length > 0 ? (
          <View className="gap-sm" testID="circle-requests">
            <View className="flex-row items-center gap-sm">
              <Text className="text-label uppercase text-ink-2">
                {t('circles.detail.requests')}
              </Text>
              <Badge kind="badge-yellow" label={String(circle.requests.length)} />
            </View>
            {circle.full ? (
              <Notification
                level="reminder"
                title={t('circles.detail.fullNote')}
                testID="requests-full"
              />
            ) : null}
            {circle.requests.map((request) => {
              const name = displayName(request);
              return (
                <Card key={request.id} testID={`request-${request.id}`}>
                  <View className="flex-row items-center gap-sm">
                    <Avatar name={request.first_name} seed={request.id} size="md" />
                    <Text className="flex-1 text-h3 text-ink" selectable={false}>
                      {name}
                    </Text>
                    <VerifiedBadge verified={request.verified} />
                  </View>
                  {circle.full ? null : (
                    <View className="flex-row gap-sm">
                      <Button
                        variant="secondary"
                        size="small"
                        label={t('circles.detail.accept')}
                        accessibilityLabel={t('circles.detail.acceptA11y', { name })}
                        onPress={() => accept.mutate({ id: request.id, name })}
                        testID={`accept-${request.id}`}
                      />
                      <Button
                        variant="ghost"
                        size="small"
                        label={t('circles.detail.decline')}
                        accessibilityLabel={t('circles.detail.declineA11y', { name })}
                        onPress={() => decline.mutate({ id: request.id, name })}
                        testID={`decline-${request.id}`}
                      />
                    </View>
                  )}
                </Card>
              );
            })}
            <Text className="text-caption text-ink-3">{t('circles.detail.noReason')}</Text>
          </View>
        ) : null}

        <View className="gap-sm" testID="circle-outings">
          <Text className="text-label uppercase text-ink-2">{t('circles.detail.outings')}</Text>
          {next ? (
            <View accessible className="gap-xs">
              <Text className="text-caption text-ink-2">{t('circles.detail.nextOuting')}</Text>
              <Text className="text-data text-ink">
                {formatTime(next.starts_at, next.time_zone)}
              </Text>
              <Text className="text-body font-medium text-ink">
                {`${formatShortDay(next.starts_at, next.time_zone, locale)} · ${next.area.label}`}
              </Text>
            </View>
          ) : (
            <Text className="text-caption text-ink-3">{t('circles.detail.noOutings')}</Text>
          )}
          {circle.events.map((event) => (
            <Pressable
              key={event.id}
              accessibilityRole="button"
              accessibilityLabel={event.title}
              onPress={() => router.push(`/events/${event.id}`)}
              testID={`circle-event-${event.id}`}
            >
              <Card>
                <Badge kind="badge-sky" label={t('circles.event.badge', { name: circle.name })} />
                <Text className="text-h3 text-ink">{event.title}</Text>
                <Text className="text-body text-ink-2">
                  {`${formatShortDay(event.starts_at, event.time_zone, locale)} · ${formatTime(event.starts_at, event.time_zone)}–${formatTime(event.ends_at, event.time_zone)} · ${event.area.label}`}
                </Text>
                <View className="flex-row items-center gap-sm">
                  <Text className="flex-1 text-body text-ink">{displayName(event.host)}</Text>
                  <VerifiedBadge verified={event.host.verified} />
                </View>
              </Card>
            </Pressable>
          ))}
          {circle.can.invite ? (
            <View className="items-start">
              <TextLink
                label={t('circles.detail.suggestOuting')}
                onPress={() => router.push(`/events/new?circle=${circle.id}`)}
                testID="circle-suggest-link"
              />
            </View>
          ) : null}
        </View>

        <Card testID="circle-routines">
          <View className="flex-row items-center gap-sm">
            <Text className="flex-1 text-h3 text-ink">{t('circles.detail.routines')}</Text>
            {verifiedMe ? <Badge kind="badge-yellow" label={t('circles.detail.soon')} /> : null}
          </View>
          {verifiedMe ? (
            <Text className="text-body text-ink-2">{t('circles.detail.routinesBody')}</Text>
          ) : (
            <>
              <Text className="text-body text-ink-2">{t('circles.detail.routinesHidden')}</Text>
              <View className="items-start">
                <TextLink
                  label={t('circles.join.verify')}
                  onPress={() => router.push('/verify')}
                  testID="routines-verify"
                />
              </View>
            </>
          )}
        </Card>

        <View className="gap-sm" testID="circle-members">
          <Text className="text-label uppercase text-ink-2">
            {t('circles.detail.members', { count: circle.members.length })}
          </Text>
          {circle.members.map((member) => {
            const name = displayName(member);
            const hasOptions = !member.me || circle.can.step_down;
            return (
              <View
                key={member.id}
                className="flex-row items-center gap-sm"
                style={{ minHeight: 56 }}
                testID={`member-${member.id}`}
              >
                <Avatar name={member.first_name} seed={member.id} size="md" />
                <View className="flex-1">
                  {/* AC-4.7: names can't be selected or copied all at once. */}
                  <Text className="text-body font-medium text-ink" selectable={false}>
                    {member.me ? `${name} ${t('circles.detail.you')}` : name}
                  </Text>
                  {member.city_shown ? (
                    <Text className="text-caption text-ink-3">{member.city_shown}</Text>
                  ) : null}
                </View>
                <VerifiedBadge verified={member.verified} />
                {member.role !== 'member' ? <RoleBadge role={member.role} /> : null}
                {hasOptions ? (
                  <HeaderIconButton
                    icon={Ellipsis}
                    accessibilityLabel={t('circles.detail.optionsFor', { name })}
                    onPress={() => setSheet({ kind: 'member', member })}
                    testID={`member-options-${member.id}`}
                  />
                ) : null}
              </View>
            );
          })}
          <Text className="text-caption text-ink-3">{t('circles.detail.membersNote')}</Text>
        </View>

        <View className="items-center gap-xs">
          {circle.can.edit ? (
            <TextLink
              quiet
              label={t('circles.detail.edit')}
              onPress={() => router.push(`/circles/${circle.id}/edit`)}
              testID="circle-edit"
            />
          ) : null}
          <TextLink
            quiet
            label={t('circles.detail.report')}
            onPress={() => setReport({ key: Date.now() })}
            testID="circle-report"
          />
          <DestructiveLink
            label={t('circles.detail.leave')}
            onPress={() => setSheet(circle.can.leave ? { kind: 'leave' } : { kind: 'sole' })}
            testID="circle-leave"
          />
        </View>
      </ScrollView>

      <BottomSheet visible={sheet?.kind === 'menu'} onClose={close} testID="circle-menu">
        {circle.can.edit ? (
          <SheetAction
            icon={Pencil}
            label={t('circles.detail.edit')}
            onPress={() => {
              close();
              router.push(`/circles/${circle.id}/edit`);
            }}
          />
        ) : null}
        <SheetAction
          icon={Flag}
          label={t('circles.detail.report')}
          onPress={() => {
            close();
            setReport({ key: Date.now() });
          }}
          testID="menu-report"
        />
        {circle.can.delete ? (
          <SheetAction
            icon={Trash2}
            destructive
            label={t('circles.detail.delete')}
            onPress={() => setSheet({ kind: 'delete' })}
            testID="menu-delete"
          />
        ) : null}
      </BottomSheet>

      <BottomSheet visible={sheet?.kind === 'member'} onClose={close} testID="member-sheet">
        {sheet?.kind === 'member' ? (
          <MemberOptions
            member={sheet.member}
            circle={circle}
            admins={admins}
            onPromote={() => setSheet({ kind: 'promote', member: sheet.member })}
            onRemove={() => setSheet({ kind: 'remove', member: sheet.member })}
            onReport={() => {
              close();
              setReport({
                key: Date.now(),
                member: { id: sheet.member.id, name: displayName(sheet.member) },
              });
            }}
            onStepDown={() => stepDown.mutate()}
          />
        ) : null}
      </BottomSheet>

      {sheet?.kind === 'remove' ? (
        <ConfirmSheet
          visible
          onClose={close}
          title={t('circles.sheets.removeTitle', { name: displayName(sheet.member) })}
          body={t('circles.sheets.removeBody', { first: sheet.member.first_name })}
          primary={{
            label: t('circles.sheets.removeConfirm', { first: sheet.member.first_name }),
            variant: 'destructive',
            icon: UserMinus,
            loading: remove.isPending,
            onPress: () => remove.mutate(sheet.member),
            testID: 'confirm-remove',
          }}
          secondary={{
            label: t('circles.sheets.removeKeep', { first: sheet.member.first_name }),
            onPress: close,
          }}
          testID="remove-sheet"
        />
      ) : null}
      {sheet?.kind === 'promote' ? (
        <ConfirmSheet
          visible
          onClose={close}
          title={t('circles.sheets.promoteTitle', { first: sheet.member.first_name })}
          body={t('circles.sheets.promoteBody', { first: sheet.member.first_name })}
          primary={{
            label: t('circles.sheets.promoteConfirm'),
            loading: promote.isPending,
            onPress: () => promote.mutate(sheet.member),
            testID: 'confirm-promote',
          }}
          secondary={{ label: t('common.cancel'), onPress: close }}
          testID="promote-sheet"
        />
      ) : null}
      <ConfirmSheet
        visible={sheet?.kind === 'leave'}
        onClose={close}
        title={t('circles.sheets.leaveTitle')}
        body={[
          t('circles.sheets.leaveBody'),
          joinedOutings ? t('circles.sheets.leaveOutings', { count: joinedOutings }) : null,
          t('circles.sheets.leaveBack'),
        ]
          .filter(Boolean)
          .join(' ')}
        primary={{
          label: t('circles.sheets.leaveConfirm'),
          variant: 'destructive',
          loading: leave.isPending,
          onPress: () => leave.mutate(),
          testID: 'confirm-leave',
        }}
        secondary={{ label: t('circles.sheets.leaveKeep'), onPress: close }}
        testID="leave-sheet"
      />
      <BottomSheet visible={sheet?.kind === 'sole'} onClose={close} testID="sole-admin-sheet">
        <Text accessibilityRole="header" className="text-h2 text-ink">
          {t('circles.sheets.soleTitle')}
        </Text>
        <Text className="text-body text-ink-2">{t('circles.sheets.soleBody')}</Text>
        {candidates.length ? (
          <Button
            size="large"
            label={t('circles.sheets.soleChoose')}
            onPress={() => setSheet({ kind: 'picker' })}
            testID="sole-choose"
          />
        ) : null}
        <Button variant="ghost" label={t('common.cancel')} onPress={close} />
        {circle.can.delete ? (
          <View className="gap-xs">
            <Text className="text-caption text-ink-3">{t('circles.sheets.soleDeleteHint')}</Text>
            <DestructiveLink
              label={t('circles.detail.delete')}
              onPress={() => setSheet({ kind: 'delete' })}
              testID="sole-delete"
            />
          </View>
        ) : null}
      </BottomSheet>
      <BottomSheet visible={sheet?.kind === 'picker'} onClose={close} testID="admin-picker">
        <Text accessibilityRole="header" className="text-h2 text-ink">
          {t('circles.sheets.pickerTitle')}
        </Text>
        <View accessibilityRole="radiogroup">
          {candidates.map((member) => (
            <RadioRow
              key={member.id}
              label={displayName(member)}
              selected={pick === member.id}
              onPress={() => setPick(member.id)}
              testID={`pick-${member.id}`}
            />
          ))}
        </View>
        {(() => {
          const chosen = candidates.find((member) => member.id === pick);
          return (
            <Button
              size="large"
              disabled={!chosen}
              label={
                chosen
                  ? t('circles.sheets.pickerConfirm', { first: chosen.first_name })
                  : t('circles.sheets.soleChoose')
              }
              loading={promote.isPending}
              onPress={() => chosen && promote.mutate(chosen)}
              testID="picker-confirm"
            />
          );
        })()}
      </BottomSheet>
      <ConfirmSheet
        visible={sheet?.kind === 'delete'}
        onClose={close}
        title={t('circles.sheets.deleteTitle')}
        body={t('circles.sheets.deleteBody', { count: circle.families_count })}
        primary={{
          label: t('circles.sheets.deleteConfirm'),
          variant: 'destructive',
          icon: Trash2,
          loading: destroy.isPending,
          onPress: () => destroy.mutate(),
          testID: 'confirm-delete',
        }}
        secondary={{ label: t('circles.sheets.deleteKeep'), onPress: close }}
        testID="delete-sheet"
      />
      {report ? (
        <CircleReportSheet
          key={report.key}
          circleId={circle.id}
          member={report.member}
          visible
          onClose={() => setReport(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

/** A member action that answers with the circle: stored, toast, sheet closed. */
function useCircleAction<V>(
  { close, onFail }: { close: () => void; onFail: (error: ApiError) => void },
  fn: (v: V) => Promise<{ circle: MemberCircle }>,
  toast: (v: V) => string,
) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  return useMutation<{ circle: MemberCircle }, ApiError, V>({
    mutationFn: fn,
    onSuccess: (data, v) => {
      close();
      storeCircle(queryClient, data.circle);
      showToast(toast(v));
    },
    onError: onFail,
  });
}

/** C5d Member options (design 5d): co-admin, report, remove; step down on my own row. */
function MemberOptions({
  member,
  circle,
  admins,
  onPromote,
  onRemove,
  onReport,
  onStepDown,
}: {
  member: CircleMember;
  circle: MemberCircle;
  admins: number;
  onPromote: () => void;
  onRemove: () => void;
  onReport: () => void;
  onStepDown: () => void;
}) {
  const { t } = useTranslation();
  const manage = circle.can.manage;
  return (
    <View className="gap-xs">
      <View className="flex-row items-center gap-sm pb-sm">
        <Avatar name={member.first_name} seed={member.id} size="md" />
        <Text className="flex-1 text-h3 text-ink">{displayName(member)}</Text>
        <VerifiedBadge verified={member.verified} />
      </View>
      {member.me ? (
        <SheetAction
          icon={UserRoundCog}
          label={t('circles.detail.stepDown')}
          onPress={onStepDown}
          testID="step-down"
        />
      ) : (
        <>
          {manage && member.role === 'member' ? (
            member.verified && admins < 3 ? (
              <SheetAction
                icon={UserRoundCog}
                label={t('circles.detail.makeCoAdmin')}
                onPress={onPromote}
                testID="make-co-admin"
              />
            ) : (
              <View
                style={{ minHeight: MIN_TOUCH_TARGET }}
                className="justify-center"
                testID="co-admin-unavailable"
              >
                <Text className="text-body text-ink-3">{t('circles.detail.makeCoAdmin')}</Text>
                <Text className="text-caption text-ink-3">
                  {member.verified
                    ? t('circles.detail.adminMax')
                    : t('circles.detail.notVerifiedYet')}
                </Text>
              </View>
            )
          ) : null}
          <SheetAction
            icon={Flag}
            label={t('circles.detail.reportMember')}
            onPress={onReport}
            testID="report-member"
          />
          {manage && member.role === 'member' && !member.creator ? (
            <SheetAction
              icon={UserMinus}
              destructive
              label={t('circles.detail.remove')}
              onPress={onRemove}
              testID="remove-member"
            />
          ) : null}
        </>
      )}
    </View>
  );
}
