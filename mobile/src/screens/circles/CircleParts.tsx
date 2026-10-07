import type { TFunction } from 'i18next';
import { Globe, Info, Lock, Users } from 'lucide-react-native';
import { type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type { CircleRole, CircleVisibility } from '../../api/circles';
import type { ApiError } from '../../api/errors';
import { Badge } from '../../components/Badge';
import { Icon } from '../../components/Icon';
import { Skeleton } from '../../components/Skeleton';
import { shadows } from '../../theme/colors';
import { BadgeSheet } from '../account/BadgeSheet';

/**
 * Community Card (design system section 7, design circles section 6): Surface, radius-lg,
 * hairline border, 4 px sky bar on the left. `neutral`: the dashed outline of pending and
 * status cards (design gap 2).
 */
export function CommunityCard({
  children,
  neutral = false,
  testID,
}: {
  children: ReactNode;
  neutral?: boolean;
  testID?: string;
}) {
  if (neutral) {
    return (
      <View
        testID={testID}
        className="gap-sm rounded-lg border-[1.5px] border-dashed border-ink-3 bg-surface/60 px-lg py-md"
      >
        {children}
      </View>
    );
  }
  return (
    <View
      testID={testID}
      className="flex-row overflow-hidden rounded-lg border-[0.5px] border-border-soft bg-surface"
      style={{ boxShadow: shadows.card }}
    >
      <View className="w-1 bg-sky" />
      <View className="flex-1 gap-sm px-lg py-md">{children}</View>
    </View>
  );
}

/**
 * AC-7.3 (QA B2): a paused or closed circle refuses every admin action and every join; the
 * app says why with the circle's status line.
 */
export function circleStatusError(error: ApiError | null | undefined, t: TFunction): string | null {
  if (error?.code === 'circle_paused') return t('circles.detail.statusPaused');
  if (error?.code === 'circle_closed') return t('circles.detail.statusClosed');
  return null;
}

/**
 * AC-2.7 (PM phone test 2026-10-07): asking again after a decline or a removal is refused
 * and the app says so honestly instead of « Demande envoyée ». Nothing else about the circle.
 */
export function joinRefusal(error: ApiError | null | undefined, t: TFunction): string | null {
  if (error?.code === 'circle_request_declined') return t('circles.join.declined');
  if (error?.code === 'circle_membership_removed') return t('circles.join.removed');
  return null;
}

/** A plain Surface card (detail sections). */
export function Card({ children, testID }: { children: ReactNode; testID?: string }) {
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

/** `globe` "Cercle public" or `lock` "Cercle privé": text and icon (design 11). */
export function TypeLine({ visibility }: { visibility: CircleVisibility }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-xs" accessible testID={`type-${visibility}`}>
      <Icon icon={visibility === 'public' ? Globe : Lock} size={14} color="ink-2" />
      <Text className="text-caption text-ink-2">{t(`circles.type.${visibility}`)}</Text>
    </View>
  );
}

/** "12 familles · Paris 11e" with the `users` icon. */
export function FamiliesLine({
  count,
  area,
  max,
}: {
  count: number;
  area: string;
  /** "12 familles sur 25" on the detail. */
  max?: number;
}) {
  const { t } = useTranslation();
  const families = max ? t('circles.familiesOf', { count, max }) : t('circles.families', { count });
  return (
    <View className="flex-row items-center gap-xs" accessible>
      <Icon icon={Users} size={16} color="ink-2" />
      <Text className="text-body text-ink">{`${families} · ${area}`}</Text>
    </View>
  );
}

/** Role badges: sky for Admin and Co-admin, neutral for Member (design 6). */
export function RoleBadge({ role }: { role: CircleRole }) {
  const { t } = useTranslation();
  return (
    <Badge
      kind={role === 'member' ? 'badge-neutral' : 'badge-sky'}
      label={t(`circles.role.${role}`)}
      testID={`role-${role}`}
    />
  );
}

/**
 * The verification badge, tappable: it opens the explanation sheet, never the reason
 * (AC-4.3, AC-8.1).
 */
export function VerifiedBadge({ verified, testID }: { verified: boolean; testID?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<View>(null);
  const label = verified ? t('events.badge.verified') : t('events.badge.notVerified');
  return (
    <>
      <Badge
        ref={ref}
        kind={verified ? 'badge-green' : 'badge-neutral'}
        label={label}
        accessibilityLabel={
          verified ? t('events.badge.verifiedA11y') : t('badge.opensExplanation', { status: label })
        }
        onPress={() => setOpen(true)}
        testID={testID}
      />
      <BadgeSheet
        verified={verified}
        visible={open}
        onClose={() => setOpen(false)}
        returnFocusTo={ref}
      />
    </>
  );
}

/** The dashed neutral card with the `info` icon (AC-9.3, AC-5.2). */
export function NeutralLine({ text }: { text: string }) {
  return (
    <View className="flex-row items-center gap-sm">
      <Icon icon={Info} size={18} color="ink-2" />
      <Text className="flex-1 text-body text-ink">{text}</Text>
    </View>
  );
}

/** Skeleton of two circle cards (design 1e, 8f). */
export function CardsSkeleton({ label }: { label: string }) {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} className="gap-md">
      {[0, 1].map((i) => (
        <View key={i} className="gap-sm rounded-lg bg-surface p-lg">
          <Skeleton width="60%" height={16} />
          <Skeleton width="40%" height={12} />
          <Skeleton width="80%" height={12} />
        </View>
      ))}
    </View>
  );
}
