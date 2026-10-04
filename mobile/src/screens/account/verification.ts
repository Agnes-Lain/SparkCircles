import type { TFunction } from 'i18next';

import type { Verification } from '../../api/types';
import type { BadgeKind } from '../../components/Badge';
import type { Locale } from '../../i18n';
import { formatDate, formatDayMonth, formatMomentDayTime } from '../../i18n/format';

/** The owner's view of their verification (design A1 table), one row per status. */
export type OwnerVerificationState =
  'notVerified' | 'pending' | 'verified' | 'expiresSoon' | 'rejected' | 'expired' | 'revoked';

export function ownerVerificationState(v: Verification): OwnerVerificationState {
  if (v.verified) return v.expires_soon ? 'expiresSoon' : 'verified';
  switch (v.status) {
    case 'pending':
      return 'pending';
    case 'rejected':
      return 'rejected';
    case 'expired':
      return 'expired';
    default:
      return v.revoked ? 'revoked' : 'notVerified';
  }
}

const BADGE: Record<OwnerVerificationState, { kind: BadgeKind; key: string }> = {
  notVerified: { kind: 'badge-neutral', key: 'badge.notVerified' },
  pending: { kind: 'badge-yellow', key: 'badge.pending' },
  verified: { kind: 'badge-green', key: 'badge.verified' },
  expiresSoon: { kind: 'badge-yellow', key: 'badge.expiresSoon' },
  rejected: { kind: 'badge-yellow', key: 'badge.notAccepted' },
  expired: { kind: 'badge-yellow', key: 'badge.expired' },
  revoked: { kind: 'badge-neutral', key: 'badge.notVerified' },
};

export function ownerBadge(state: OwnerVerificationState, t: TFunction) {
  const { kind, key } = BADGE[state];
  return { kind, label: t(key as 'badge.pending') };
}

/** Title, body and caption of the A1 verification card. */
export function verificationCard(
  v: Verification,
  state: OwnerVerificationState,
  t: TFunction,
  locale: Locale,
): { title: string; body: string; caption?: string } {
  switch (state) {
    case 'pending':
      return {
        title: t('verificationCard.pendingTitle'),
        body: t('verificationCard.pendingBody'),
        caption: v.submitted_at
          ? t('verificationCard.pendingCaption', {
              date: formatMomentDayTime(v.submitted_at, locale),
            })
          : undefined,
      };
    case 'verified':
      return {
        title: t('verificationCard.verifiedTitle'),
        body: v.expires_on
          ? t('verificationCard.verifiedBody', { date: formatDate(v.expires_on, locale) })
          : '',
        caption: renewalCaption(v, t),
      };
    case 'expiresSoon':
      return {
        title: t('verificationCard.expiresSoonTitle', {
          date: v.expires_on ? formatDayMonth(v.expires_on, locale) : '',
        }),
        body: t('verificationCard.expiresSoonBody'),
        caption: renewalCaption(v, t),
      };
    case 'rejected':
      return { title: t('verificationCard.rejectedTitle'), body: v.rejection?.message ?? '' };
    case 'expired':
      return { title: t('verificationCard.expiredTitle'), body: t('verificationCard.expiredBody') };
    case 'revoked':
      return { title: t('verificationCard.revokedTitle'), body: v.rejection?.message ?? '' };
    default:
      return {
        title: t('verificationCard.notVerifiedTitle'),
        body: t('verificationCard.notVerifiedBody'),
      };
  }
}

/** AC-7.15: a renewal sent early is shown as "Renewal pending" while the parent stays verified. */
function renewalCaption(v: Verification, t: TFunction): string | undefined {
  if (v.renewal?.status === 'pending') return t('verify.status.renewalPending');
  if (v.renewal?.status === 'rejected') return v.renewal.rejection?.message;
  return undefined;
}

export type CardAction = {
  label: string;
  variant: 'primary' | 'ghost';
  href: '/verify' | '/verify/status';
};

/**
 * The A1 card's button (design A1 table, M-1): verify actions open V0, "See details" opens
 * V5. A verified parent gets the "What this means" link instead, unless a renewal is in
 * progress (AC-7.15).
 */
export function verificationCardAction(
  v: Verification,
  state: OwnerVerificationState,
  t: TFunction,
): CardAction | null {
  const seeDetails: CardAction = {
    label: t('verify.status.seeDetails'),
    variant: 'ghost',
    href: '/verify/status',
  };
  if (v.verified && v.renewal) return seeDetails;
  switch (state) {
    case 'notVerified':
      return { label: t('verify.gate.start'), variant: 'primary', href: '/verify' };
    case 'pending':
      return seeDetails;
    case 'rejected':
      return { label: t('verify.status.tryAgain'), variant: 'primary', href: '/verify' };
    case 'expiresSoon':
    case 'expired':
    case 'revoked':
      return { label: t('verify.status.verifyAgain'), variant: 'primary', href: '/verify' };
    default:
      return null;
  }
}
