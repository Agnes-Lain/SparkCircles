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
      };
    case 'expiresSoon':
      return {
        title: t('verificationCard.expiresSoonTitle', {
          date: v.expires_on ? formatDayMonth(v.expires_on, locale) : '',
        }),
        body: t('verificationCard.expiresSoonBody'),
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
