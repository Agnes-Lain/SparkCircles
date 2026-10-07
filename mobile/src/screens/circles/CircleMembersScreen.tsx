import { useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ellipsis, UserMinus, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { circles } from '../../api';
import { type CircleMember, isMemberCircle, type MemberCircle } from '../../api/circles';
import type { ApiError } from '../../api/errors';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { HeaderIconButton } from '../../components/HeaderIconButton';
import { Notification } from '../../components/Notification';
import { SectionLabel, SettingsList } from '../../components/SettingsList';
import { Skeleton } from '../../components/Skeleton';
import { useToast } from '../../components/ToastProvider';
import { useBack } from '../auth/useBack';
import { ConfirmSheet } from '../events/ConfirmSheet';
import { MemberOptions, useCircleAction } from './circleActions';
import { Card, circleStatusError, RoleBadge, VerifiedBadge } from './CircleParts';
import { CircleReportSheet } from './CircleReportSheet';
import { displayName, refreshCircles, useCircle } from './queries';

type Sheet =
  | null
  | { kind: 'member'; member: CircleMember }
  | { kind: 'remove'; member: CircleMember }
  | { kind: 'promote'; member: CircleMember };

/**
 * `/circles/:id/members`, the « Membres » tool (PM decision 2026-10-07): everyone sees the
 * members (AC-4.1); admins also invite (AC-2.1), answer requests (AC-2.4, AC-2.5) and manage
 * members (AC-5.2, AC-6.1). Anything but a member view goes back to the circle page.
 */
export function CircleMembersScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const back = useBack(`/circles/${id}`);
  const query = useCircle(id);
  const circle = query.data;

  if (circle && isMemberCircle(circle)) return <MembersView circle={circle} back={back} />;
  if (circle || query.error?.status === 404) return <Redirect href={`/circles/${id}`} />;

  return (
    <SafeAreaView edges={['top']} className="flex-1" testID="circle-members-screen">
      <View className="gap-lg px-lg pt-lg">
        <Header title={t('circles.members.title')} onBack={back} />
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
            testID="members-error"
          />
        ) : (
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t('circles.detail.loading')}
            className="gap-lg"
            testID="members-loading"
          >
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={48} roundedClassName="rounded-lg" />
            ))}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function MembersView({ circle, back }: { circle: MemberCircle; back: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [report, setReport] = useState<{ key: number; member: { id: string; name: string } }>();
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
  const admins = circle.members.filter((member) => member.role !== 'member').length;

  return (
    <SafeAreaView edges={['top']} className="flex-1" testID="circle-members-screen">
      <ScrollView contentContainerClassName="gap-lg px-lg pb-3xl pt-lg">
        <Header title={t('circles.members.title')} onBack={back} />

        {circle.can.invite && !circle.admin_rights_paused ? (
          <SettingsList
            roomy
            items={[
              {
                key: 'invite',
                icon: UserPlus,
                iconTone: 'sky',
                label: t('circles.detail.invite'),
                caption: t('circles.members.inviteCaption'),
                accessibilityLabel: t('circles.members.inviteA11y'),
                onPress: () => router.push(`/circles/${circle.id}/invite`),
                testID: 'circle-invite',
              },
            ]}
          />
        ) : null}

        {manage && circle.requests.length > 0 ? (
          <View className="gap-sm" testID="circle-requests">
            <View className="flex-row items-center gap-sm">
              <SectionLabel>{t('circles.detail.requests')}</SectionLabel>
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

        <View className="gap-sm" testID="circle-members">
          <SectionLabel>
            {t('circles.detail.members', { count: circle.members.length })}
          </SectionLabel>
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
      </ScrollView>

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
      {report ? (
        <CircleReportSheet
          key={report.key}
          circleId={circle.id}
          member={report.member}
          visible
          onClose={() => setReport(undefined)}
        />
      ) : null}
    </SafeAreaView>
  );
}
