import type { Href } from 'expo-router';
import type { TFunction } from 'i18next';
import { CalendarPlus, type LucideIcon, Repeat, Users } from 'lucide-react-native';

import type { MemberCircle } from '../../api/circles';
import type { BadgeKind } from '../../components/Badge';
import type { IconSquareTone } from '../../components/IconSquare';

/**
 * One row of « Outils du cercle » (circles design, PM decision 2026-10-07, option A). Adding a
 * tool is adding an entry to `circleTools`: the title is the action, the caption says what it
 * is for, and a tool without `href` is a « Bientôt » row (no chevron, not tappable).
 */
export type CircleTool = {
  key: string;
  icon: LucideIcon;
  tone: IconSquareTone;
  label: string;
  caption: string;
  accessibilityLabel: string;
  badge?: { label: string; kind: BadgeKind };
  href?: Href;
};

/** The tools a member sees, in order. `verified`: my identity is checked (events AC-1.1). */
export function circleTools(circle: MemberCircle, verified: boolean, t: TFunction): CircleTool[] {
  const requests = circle.can.manage ? circle.requests.length : 0;
  const membersCaption = [
    t('circles.detail.toolMembersCount', { count: circle.members.length }),
    requests ? t('circles.detail.toolRequests', { count: requests }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const suggestCaption = verified
    ? t('circles.detail.toolSuggestCaption')
    : t('circles.detail.toolVerifyFirst');

  return [
    {
      key: 'members',
      icon: Users,
      tone: 'sky',
      label: t('circles.detail.toolMembers'),
      caption: membersCaption,
      accessibilityLabel: t('circles.detail.toolMembersA11y', { caption: membersCaption }),
      badge: requests ? { label: String(requests), kind: 'badge-sky' } : undefined,
      href: `/circles/${circle.id}/members`,
    },
    {
      // Hosting needs a verified identity (events AC-1.1): otherwise the row leads to it.
      key: 'suggest',
      icon: CalendarPlus,
      tone: verified ? 'sky' : 'neutral',
      label: t('circles.detail.suggestOuting'),
      caption: suggestCaption,
      accessibilityLabel: t('circles.detail.toolSuggestA11y', { caption: suggestCaption }),
      href: verified ? `/events/new?circle=${circle.id}` : '/verify',
    },
    {
      // v2: shows no place or time yet, so it is the same row for everyone (AC-4.4).
      key: 'routines',
      icon: Repeat,
      tone: 'sky',
      label: t('circles.detail.toolRoutines'),
      caption: t('circles.detail.toolRoutinesCaption'),
      accessibilityLabel: t('circles.detail.toolRoutinesA11y'),
      badge: { label: t('circles.detail.soon'), kind: 'badge-yellow' },
    },
  ];
}
