import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Clock, UserPlus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { circles } from '../../api';
import type { MyCircleItem } from '../../api/circles';
import { useMe } from '../../auth/useMe';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { Notification } from '../../components/Notification';
import { TextLink } from '../../components/TextLink';
import { useToast } from '../../components/ToastProvider';
import { resolveLocale } from '../../i18n';
import { MIN_TOUCH_TARGET } from '../../theme/a11y';
import { clockTime, formatShortDay, formatTime } from '../events/format';
import { useGuestAccount } from '../guest/useGuestAccount';
import {
  CardsSkeleton,
  CommunityCard,
  FamiliesLine,
  NeutralLine,
  RoleBadge,
  TypeLine,
} from './CircleParts';
import { refreshCircles, useMyCircles } from './queries';

/**
 * C1 "Mes cercles" (AC-9.1 to AC-9.3, AC-3.6, AC-2.6): my circles (requests to answer
 * first), my pending and expired requests, neutral cards without data, then "Créer un
 * cercle" and "J'ai un code". Empty: 1b (verified) or 1c (not verified, verify path).
 */
export function MyCirclesList() {
  const { t } = useTranslation();
  const router = useRouter();
  const me = useMe();
  const query = useMyCircles();
  const verified = me.data?.verification.verified ?? false;
  const data = query.data;
  const items = data?.items ?? [];
  const canCreate = data?.limits.can_create ?? verified;

  const actions = (
    <View className="gap-sm">
      {verified ? (
        <>
          <Button
            size="large"
            label={t('circles.create')}
            onPress={() => router.push('/circles/new')}
            testID="create-circle"
          />
          <Button
            variant="ghost"
            label={t('circles.haveCode')}
            onPress={() => router.push('/circles/code')}
            testID="have-code"
          />
        </>
      ) : (
        <VerifyToCreate />
      )}
    </View>
  );

  let body;
  if (!data && query.isPending) {
    body = <CardsSkeleton label={t('circles.loading')} />;
  } else if (!data) {
    body = <LoadError onRetry={() => void query.refetch()} />;
  } else if (items.length === 0) {
    body = verified ? (
      <EmptyState
        module="community"
        emoji="🏡"
        title={t('circles.empty.title')}
        body={t('circles.empty.body')}
        testID="circles-empty"
      >
        <Button
          variant="module"
          module="community"
          label={t('circles.create')}
          onPress={() => router.push('/circles/new')}
          testID="create-circle"
        />
        <Button
          variant="ghost"
          label={t('circles.haveCode')}
          onPress={() => router.push('/circles/code')}
          testID="have-code"
        />
      </EmptyState>
    ) : (
      <EmptyState
        module="community"
        emoji="🏡"
        title={t('circles.empty.title')}
        body={t('circles.empty.body')}
        testID="circles-empty-unverified"
      >
        <Button
          variant="module"
          module="community"
          label={t('circles.haveCode')}
          onPress={() => router.push('/circles/code')}
          testID="have-code"
        />
        <VerifyToCreate inline />
      </EmptyState>
    );
  } else {
    body = (
      <>
        {query.error ? (
          <Notification
            level="error"
            title={t('circles.loadError.title')}
            caption={t('circles.updatedAt', { time: clockTime(query.dataUpdatedAt) })}
            testID="circles-stale"
          />
        ) : null}
        <Text className="text-label uppercase text-ink-2">{t('circles.mine')}</Text>
        {items.map((item) => (
          <CircleItem key={item.id} item={item} />
        ))}
        {canCreate || !verified ? (
          actions
        ) : (
          <Button
            variant="ghost"
            label={t('circles.haveCode')}
            onPress={() => router.push('/circles/code')}
            testID="have-code"
          />
        )}
      </>
    );
  }

  return (
    <ScrollView
      contentContainerClassName="gap-md px-lg pb-3xl"
      refreshControl={
        <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
      }
      testID="my-circles"
    >
      {body}
    </ScrollView>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Notification
      level="error"
      title={t('circles.loadError.title')}
      caption={t('circles.loadError.caption')}
      action={
        <Button variant="secondary" size="small" label={t('errors.tryAgain')} onPress={onRetry} />
      }
      testID="circles-error"
    />
  );
}

/** 1c: joining needs a code, creating needs a checked identity (AC-9.1, AC-1.2). */
function VerifyToCreate({ inline = false }: { inline?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View className={inline ? 'gap-xs self-stretch' : 'gap-sm'} testID="verify-to-create">
      <Notification
        level="community"
        title={t('circles.verifyToCreate.title')}
        caption={t('circles.verifyToCreate.body')}
      />
      <Button
        variant="ghost"
        label={t('circles.verifyToCreate.cta')}
        onPress={() => router.push('/verify')}
        testID="verify-to-create-cta"
      />
      {inline ? null : (
        <Button
          variant="secondary"
          label={t('circles.haveCode')}
          onPress={() => router.push('/circles/code')}
          testID="have-code"
        />
      )}
    </View>
  );
}

function CircleItem({ item }: { item: MyCircleItem }) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const dismiss = useMutation({
    mutationFn: () => circles().dismissCard(item.id),
    onSettled: () => refreshCircles(queryClient),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => circles().cancelRequest(id),
    onSuccess: () => showToast(t('circles.requestCancelled')),
    onError: () => showToast(t('circles.detail.actionError')),
    onSettled: () => refreshCircles(queryClient),
  });

  if (item.state === 'member') {
    const circle = item.circle;
    const preview = circle.members_preview;
    const more = circle.families_count - preview.length;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={circle.name}
        onPress={() => router.push(`/circles/${circle.id}`)}
        testID={`circle-card-${circle.id}`}
      >
        <CommunityCard>
          <View className="flex-row items-start justify-between gap-sm">
            <Text className="flex-1 text-h3 text-ink">{circle.name}</Text>
            {circle.new ? <Badge kind="badge-lavender" label={t('circles.new')} /> : null}
            <RoleBadge role={circle.my_role} />
          </View>
          <FamiliesLine count={circle.families_count} area={circle.area.label} />
          <TypeLine visibility={circle.visibility} />
          <View className="flex-row items-center">
            {preview.map((person, index) => (
              <View key={person.seed} style={{ marginLeft: index === 0 ? 0 : -6 }}>
                <Avatar name={person.first_name} seed={person.seed} size="sm" />
              </View>
            ))}
            {more > 0 ? (
              <Text className="ml-xs text-caption text-ink-2">
                {t('circles.moreMembers', { count: more })}
              </Text>
            ) : null}
          </View>
          <Text className="text-body font-medium text-ink">
            {circle.next_event
              ? t('circles.nextOuting', {
                  date: `${formatShortDay(circle.next_event.starts_at, circle.next_event.time_zone, locale)}, ${formatTime(circle.next_event.starts_at, circle.next_event.time_zone)}`,
                })
              : t('circles.noOuting')}
          </Text>
          {circle.requests_count > 0 ? (
            <View className="flex-row items-center gap-xs">
              <Icon icon={UserPlus} size={14} color="sunny-dark" />
              <Badge
                kind="badge-yellow"
                label={t('circles.requestsToAnswer', { count: circle.requests_count })}
                testID="requests-badge"
              />
            </View>
          ) : null}
        </CommunityCard>
      </Pressable>
    );
  }

  if (item.state === 'pending' || item.state === 'expired') {
    const circle = item.circle;
    const content = (
      <CommunityCard neutral testID={`circle-${item.state}`}>
        <Text className="text-h3 text-ink">{circle.name}</Text>
        <View className="flex-row items-center gap-xs">
          <Icon icon={Clock} size={14} color="sunny-dark" />
          <Badge
            kind="badge-yellow"
            label={item.state === 'pending' ? t('circles.pending') : t('circles.expired')}
          />
        </View>
        <FamiliesLine count={circle.families_count} area={circle.area.label} />
        {item.state === 'pending' && circle.id ? (
          <View className="items-start">
            <TextLink
              quiet
              label={t('circles.cancelRequest')}
              onPress={() => cancel.mutate(circle.id!)}
              disabled={cancel.isPending}
              testID="cancel-request"
            />
          </View>
        ) : null}
        {item.state === 'expired' ? (
          <>
            <Text className="text-caption text-ink-3">{t('circles.expiredCaption')}</Text>
            <View className="items-start">
              <TextLink quiet label={t('circles.neutral.hide')} onPress={() => dismiss.mutate()} />
            </View>
          </>
        ) : null}
      </CommunityCard>
    );
    return content;
  }

  // AC-9.3, AC-5.2: no name, no data.
  return (
    <CommunityCard neutral testID={`circle-${item.state}`}>
      <NeutralLine text={t(`circles.neutral.${item.state}`)} />
      <View className="items-start" style={{ minHeight: MIN_TOUCH_TARGET }}>
        <TextLink
          quiet
          label={t('circles.neutral.hide')}
          onPress={() => dismiss.mutate()}
          testID="hide-card"
        />
      </View>
    </CommunityCard>
  );
}

/** C1g Guest (AC-8.1, design 1d): what circles are, sign up; no circle content. */
export function GuestCirclesPanel() {
  const { t } = useTranslation();
  const account = useGuestAccount();
  const target = { tab: 'community' as const };
  return (
    <ScrollView contentContainerClassName="gap-xl px-lg pb-3xl" testID="guest-tab-community">
      <View className="items-start gap-md rounded-xl bg-sky-light px-xl py-2xl">
        <Text
          className="text-[32px]"
          accessible={false}
          importantForAccessibility="no"
          maxFontSizeMultiplier={1}
        >
          🏡
        </Text>
        <Text accessibilityRole="header" className="text-h2 text-ink">
          {t('guest.tabs.community.title')}
        </Text>
        <Text className="text-body text-ink-2">{t('guest.tabs.community.body')}</Text>
      </View>
      <View className="gap-sm">
        <Button
          size="large"
          label={t('guest.createAccount')}
          onPress={() => account.signUp(target)}
          testID="guest-tab-sign-up"
        />
        <Button
          variant="ghost"
          label={t('guest.haveAccount')}
          onPress={() => account.logIn(target)}
          testID="guest-tab-log-in"
        />
        <Text className="text-center text-caption text-ink-2">{t('circles.guest.searchHint')}</Text>
      </View>
    </ScrollView>
  );
}
