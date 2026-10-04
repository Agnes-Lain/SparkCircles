import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Clock, type LucideIcon, Mail } from 'lucide-react-native';
import { type ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Text, View } from 'react-native';

import { verification as verificationApi } from '../../api';
import type { ApiError } from '../../api/errors';
import type { Me, Verification } from '../../api/types';
import { VERIFICATION_KEY } from '../../api/verification';
import { ME_KEY, useMe } from '../../auth/useMe';
import { Badge, type BadgeKind } from '../../components/Badge';
import { Button } from '../../components/Button';
import { IconSquare } from '../../components/IconSquare';
import { Notification } from '../../components/Notification';
import { SuccessCheckmark } from '../../components/SuccessCheckmark';
import { currentLocale } from '../../i18n';
import { formatDate, formatMomentDayTime } from '../../i18n/format';
import { FormScreen } from '../auth/layouts';
import { UnreachableNotification } from '../auth/UnreachableNotification';
import { useBack } from '../auth/useBack';
import { ownerBadge, ownerVerificationState, verificationCard } from '../account/verification';

/**
 * V5 Verification status (mockup `verify-status`, AC-7.3, 7.5–7.7, 7.11–7.13, 7.15): pending
 * with the 48-hour promise, verified, not accepted with the reason, expires soon, expired,
 * and a renewal under review (the parent stays verified meanwhile). `sent=1` right after
 * "Send for review".
 */
export function StatusScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toAccount = useBack('/account');
  const { sent } = useLocalSearchParams<{ sent?: string }>();
  const queryClient = useQueryClient();
  const me = useMe();
  const query = useQuery<{ verification: Verification }, ApiError>({
    queryKey: VERIFICATION_KEY,
    queryFn: ({ signal }) => verificationApi().get(signal),
    retry: false,
  });

  // The fresh status also updates My account.
  useEffect(() => {
    const fresh = query.data?.verification;
    if (fresh)
      queryClient.setQueryData<Me>(ME_KEY, (old) => (old ? { ...old, verification: fresh } : old));
  }, [query.data, queryClient]);

  const announced = useRef(false);
  useEffect(() => {
    if (sent !== '1' || announced.current) return;
    announced.current = true;
    AccessibilityInfo.announceForAccessibility(t('verify.status.sentTitle'));
  }, [sent, t]);

  const v = query.data?.verification ?? me.data?.verification;
  if (!v) {
    return (
      <FormScreen testID="verify-status">
        {query.isError ? (
          <UnreachableNotification
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        ) : null}
      </FormScreen>
    );
  }

  const locale = currentLocale();
  const verifyAgain = () => router.push('/verify/document');
  const backButton = (
    <Button
      size="large"
      label={t('verify.status.backToAccount')}
      onPress={toAccount}
      testID="back-to-account"
    />
  );

  // AC-7.15: a renewal under review or refused while the old verification still runs.
  if (v.verified && v.renewal?.status === 'pending') {
    return (
      <PendingView
        badge={{ kind: 'badge-yellow', label: t('verify.status.renewalPending') }}
        body={t('verify.status.renewalBody')}
        sentAt={v.renewal.submitted_at}
        reviewCaption={t('verify.status.renewalReviewCaption')}
        action={backButton}
        testID="status-renewal-pending"
      />
    );
  }
  if (v.verified && v.renewal?.status === 'rejected') {
    return (
      <StatusLayout
        testID="status-renewal-rejected"
        badge={{ kind: 'badge-green', label: t('badge.verified') }}
        title={t('verify.status.rejectedTitle')}
        body={
          v.expires_on
            ? t('verify.status.renewalKept', { date: formatDate(v.expires_on, locale) })
            : undefined
        }
        action={
          <Button
            size="large"
            label={t('verify.status.tryAgain')}
            onPress={verifyAgain}
            testID="status-action"
          />
        }
      >
        {v.renewal.rejection ? (
          <Notification level="reminder" title={v.renewal.rejection.message} />
        ) : null}
      </StatusLayout>
    );
  }

  const state = ownerVerificationState(v);
  const badge = ownerBadge(state, t);

  switch (state) {
    case 'pending':
      return (
        <PendingView
          badge={badge}
          body={t('verify.status.sentBody')}
          sentAt={v.submitted_at}
          reviewCaption={t('verify.status.stepReviewCaption')}
          action={backButton}
          testID="status-pending"
        />
      );
    case 'verified':
      return (
        <StatusLayout
          testID="status-verified"
          checkmark
          badge={badge}
          title={t('verificationCard.verifiedTitle')}
          body={t('verify.status.verifiedBody')}
          action={backButton}
        >
          {v.expires_on ? (
            <DataCard
              value={formatDate(v.expires_on, locale)}
              caption={t('verify.status.validUntil')}
            />
          ) : null}
        </StatusLayout>
      );
    case 'rejected':
      return (
        <StatusLayout
          testID="status-rejected"
          badge={badge}
          title={t('verify.status.rejectedTitle')}
          action={
            <Button
              size="large"
              label={t('verify.status.tryAgain')}
              onPress={verifyAgain}
              testID="status-action"
            />
          }
        >
          {v.rejection ? (
            <Notification level="reminder" title={v.rejection.message} testID="rejection-reason" />
          ) : null}
        </StatusLayout>
      );
    default: {
      // Expires soon, expired, removed, not verified: as on the A1 card.
      const card = verificationCard(v, state, t, locale);
      const label =
        state === 'notVerified' ? t('verify.gate.start') : t('verify.status.verifyAgain');
      return (
        <StatusLayout
          testID={`status-${state}`}
          badge={badge}
          title={card.title}
          body={card.body || undefined}
          action={
            <Button size="large" label={label} onPress={verifyAgain} testID="status-action" />
          }
        />
      );
    }
  }
}

function StatusLayout({
  badge,
  title,
  body,
  checkmark = false,
  children,
  action,
  testID,
}: {
  badge: { kind: BadgeKind; label: string };
  title: string;
  body?: string;
  checkmark?: boolean;
  children?: ReactNode;
  action: ReactNode;
  testID: string;
}) {
  return (
    <FormScreen testID={testID}>
      <View className="h-xl" />
      <View className="items-start gap-lg">
        {checkmark ? <SuccessCheckmark /> : null}
        <Badge kind={badge.kind} label={badge.label} />
        <Text accessibilityRole="header" className="text-h1 text-ink">
          {title}
        </Text>
        {body ? <Text className="text-body text-ink-2">{body}</Text> : null}
      </View>
      {children}
      {action}
    </FormScreen>
  );
}

function PendingView({
  badge,
  body,
  sentAt,
  reviewCaption,
  action,
  testID,
}: {
  badge: { kind: BadgeKind; label: string };
  body: string;
  sentAt: string | null;
  reviewCaption: string;
  action: ReactNode;
  testID: string;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  return (
    <StatusLayout
      testID={testID}
      checkmark
      badge={badge}
      title={t('verify.status.sentTitle')}
      body={body}
      action={action}
    >
      <DataCard
        value={t('verify.status.reviewTime')}
        caption={t('verify.status.reviewTimeCaption')}
      />
      <View
        accessibilityLabel={t('verify.status.progress')}
        className="gap-md rounded-lg border-[0.5px] border-border-soft bg-surface p-lg"
      >
        <TimelineRow
          icon={Check}
          title={t('verify.status.stepSent')}
          caption={sentAt ? formatMomentDayTime(sentAt, locale) : undefined}
          done
        />
        <TimelineRow icon={Clock} title={t('verify.status.stepReview')} caption={reviewCaption} />
        <TimelineRow
          icon={Mail}
          title={t('verify.status.stepDecision')}
          caption={t('verify.status.stepDecisionCaption')}
        />
      </View>
    </StatusLayout>
  );
}

function DataCard({ value, caption }: { value: string; caption: string }) {
  return (
    <View
      accessible
      className="gap-xs rounded-lg border-[0.5px] border-border-soft bg-surface p-lg"
    >
      <Text className="text-data text-ink">{value}</Text>
      <Text className="text-caption text-ink-3">{caption}</Text>
    </View>
  );
}

function TimelineRow({
  icon,
  title,
  caption,
  done = false,
}: {
  icon: LucideIcon;
  title: string;
  caption?: string;
  done?: boolean;
}) {
  return (
    <View accessible className="flex-row items-center gap-md">
      <IconSquare icon={icon} tone={done ? 'verification' : 'neutral'} />
      <View className="flex-1">
        <Text className="text-body text-ink">{title}</Text>
        {caption ? <Text className="text-caption text-ink-3">{caption}</Text> : null}
      </View>
    </View>
  );
}
