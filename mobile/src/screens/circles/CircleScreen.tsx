import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft,
  Ellipsis,
  Flag,
  Info,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
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
import { useMe } from '../../auth/useMe';
import { Badge } from '../../components/Badge';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { HeaderIconButton } from '../../components/HeaderIconButton';
import { Notification } from '../../components/Notification';
import { RadioRow } from '../../components/RadioRow';
import { Skeleton } from '../../components/Skeleton';
import { SuccessCheckmark } from '../../components/SuccessCheckmark';
import { TextLink } from '../../components/TextLink';
import { useToast } from '../../components/ToastProvider';
import { ownerVerificationState } from '../account/verification';
import { MessageScreen } from '../auth/layouts';
import { useBack } from '../auth/useBack';
import { ConfirmSheet } from '../events/ConfirmSheet';
import { useGuestAccount } from '../guest/useGuestAccount';
import { DestructiveLink, SheetAction, useCircleAction } from './circleActions';
import {
  Card,
  circleStatusError,
  FamiliesLine,
  joinRefusal,
  NeutralLine,
  TypeLine,
} from './CircleParts';
import { CircleReportSheet } from './CircleReportSheet';
import { CircleOutings } from './CircleOutings';
import { CircleToolbox } from './CircleToolbox';
import { displayName, forgetCircle, refreshCircles, useCircle } from './queries';

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

  const refusal = joinRefusal(ask.error, t);
  if (refusal) {
    return (
      <MessageScreen testID="public-refused" onBack={back} icon={Info} title={refusal}>
        <Button
          variant="ghost"
          label={t('circles.join.seeCircles')}
          onPress={() => router.replace('/community')}
        />
      </MessageScreen>
    );
  }

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
  | { kind: 'leave' }
  | { kind: 'sole' }
  | { kind: 'picker' }
  | { kind: 'delete' };

/** C5 Circle detail for members (AC-2.4, AC-4.1 to AC-4.7, AC-5.x, AC-6.x, AC-7.1, AC-16.4). */
function MemberCircleView({ circle }: { circle: MemberCircle }) {
  const { t } = useTranslation();
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
  const promote = useCircleAction(
    after,
    (member: CircleMember) => circles().promote(circle.id, member.id),
    (member) => t('circles.sheets.promoted', { name: displayName(member) }),
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
  const account = useMe().data;
  const verificationPending = account
    ? ownerVerificationState(account.verification) === 'pending' ||
      account.verification.renewal?.status === 'pending'
    : false;
  // Backlog #38 (circles AC-6.5): no verified admin left. An admin whose own rights are
  // paused sees the paused card instead, never both.
  const noVerifiedAdmin = !circle.has_verified_admin && !circle.admin_rights_paused;
  const joinedOutings = circle.events.filter((event) => event.joined).length;
  const candidates = circle.members.filter(
    (member) => !member.me && member.verified && member.role === 'member',
  );

  // PM decision 2026-10-07: an admin alone in the circle is prompted to invite families.
  const alone = circle.can.invite && !circle.admin_rights_paused && circle.members.length <= 1;

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
            caption={alone ? undefined : t('circles.detail.createdBody')}
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
        {noVerifiedAdmin ? (
          <Notification
            level="reminder"
            title={t('circles.detail.noAdminTitle')}
            caption={
              verifiedMe
                ? t('circles.detail.noAdminBodyVerified')
                : verificationPending
                  ? `${t('circles.detail.noAdminBody')} ${t('circles.detail.noAdminPending')}`
                  : t('circles.detail.noAdminBody')
            }
            action={
              verifiedMe || verificationPending ? undefined : (
                <Button
                  variant="secondary"
                  size="small"
                  icon={ShieldCheck}
                  label={t('circles.detail.noAdminCta')}
                  onPress={() => router.push('/verify')}
                  testID="notice-no-admin-verify"
                />
              )
            }
            testID="notice-no-admin"
          />
        ) : null}
        {/* Merged into the notice above when no admin is verified (design polish #38). */}
        {manage && !noVerifiedAdmin && circle.visibility === 'public' && !circle.discoverable ? (
          <Notification level="reminder" title={t('circles.detail.hiddenFromSearch')} />
        ) : null}

        {alone ? (
          <Notification
            level="community"
            title={t('circles.detail.aloneTitle')}
            caption={t('circles.detail.aloneBody')}
            action={
              <Button
                variant="secondary"
                size="small"
                icon={UserPlus}
                label={t('circles.detail.invite')}
                onPress={() => router.push(`/circles/${circle.id}/invite`)}
                testID="circle-invite"
              />
            }
            testID="circle-alone"
          />
        ) : null}

        <CircleToolbox circle={circle} verified={verifiedMe} />

        <CircleOutings circle={circle} />

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
