import { Calendar, Lock, MapPin, ShieldCheck, Users } from 'lucide-react-native';
import { type RefObject, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import type { SparkEvent } from '../api/events';
import { resolveLocale } from '../i18n';
import { CATEGORY_ICON } from '../screens/events/categories';
import {
  personName,
  placesText,
  titleText,
  statusBadge,
  whenText,
  whereText,
} from '../screens/events/presenters';
import { shadows } from '../theme/colors';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { CategoryPill } from './CategoryPill';
import { Icon } from './Icon';
import { LanguageTag } from './LanguageTag';

/** Room kept at the top right for the future wishlist heart (backlog #24). */
const HEART_SLOT = 44;

export type EventCardProps = {
  event: SparkEvent;
  onPress: () => void;
  /** Opens sheet B1 about the host's badge (the card's own control, AC-6.5). */
  onBadgePress: (ref: RefObject<View | null>) => void;
  /** "Mes sorties": lifecycle badges and "You" for the host. */
  mine?: boolean;
};

/**
 * Event Card (design events section 4.2, replaces the DS card, gap G2). Type line first,
 * host + badge before the places, never participant avatars, names or the exact address.
 * The whole card is one link; the badge is a separate control (and an action for screen
 * readers, which read the card as one element).
 */
export function EventCard({ event, onPress, onBadgePress, mine = false }: EventCardProps) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const badgeRef = useRef<View>(null);
  const isHost = event.viewer.role === 'host';
  const host = event.host;
  const hostName = isHost ? t('events.person.you') : host ? personName(host, t) : null;
  const status = statusBadge(event, t, mine);
  const full = event.full || event.places.left <= 0;
  const places = placesText(event, t);
  const when = whenText(event, locale, t);
  const where = whereText(event, t, locale);
  const title = titleText(event, t);
  const category = event.category ? t(`events.categories.${event.category}`) : null;
  const total = event.places.total ?? 0;
  const filled = total > 0 ? event.places.taken / total : 0;
  // Guests (US-15 table, AC-15.2, AC-15.4): no host name, initial or avatar, only "Organisée
  // par un parent vérifié"; a verified-only event shows no host information at all, the lock
  // badge and the locked call to action instead.
  const guest = event.viewer.role === 'guest';
  const locked = guest && event.join_rule === 'verified_only';
  const showBadge = guest
    ? !locked && Boolean(host?.verified)
    : Boolean(host && !host.former_member && host.verified && !isHost);

  const guestLabel = guest
    ? [
        t('guest.card.a11y', { type: t('events.type'), title, when, where, places }),
        locked
          ? `${t('guest.card.verifiedOnly')}, ${t('guest.card.lockedCta')}`
          : showBadge
            ? t('guest.card.hostedBy') + t('events.card.verifiedSuffix')
            : null,
      ]
        .filter(Boolean)
        .join(', ')
    : null;

  const label = [
    guestLabel ??
      t('events.card.a11y', {
        type: t('events.type'),
        title,
        when,
        where,
        places,
        host: hostName ?? '',
      }) + (showBadge ? t('events.card.verifiedSuffix') : ''),
    category,
    // AC-16.2: the card is read as one element, so its label carries the language tag too.
    event.language && event.language !== locale
      ? t(`events.language.a11y.${event.language}`)
      : null,
    status?.label,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      testID={`event-card-${event.id}`}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityActions={
        showBadge ? [{ name: 'badge', label: t('events.badge.verifiedA11y') }] : []
      }
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'badge') onBadgePress(badgeRef);
      }}
      onPress={onPress}
      className="flex-row overflow-hidden rounded-lg border-[0.5px] border-border-soft bg-surface"
      style={{ boxShadow: shadows.card }}
    >
      <View className="w-1 bg-green" accessible={false} importantForAccessibility="no" />
      <View className="flex-1 gap-sm px-lg py-md">
        <View className="flex-row items-center gap-xs" style={{ paddingRight: HEART_SLOT }}>
          <Icon icon={Users} size={14} color="ink-2" />
          <Text className="text-caption font-medium text-ink-2">{t('events.type')}</Text>
        </View>
        <Text numberOfLines={2} className="text-h3 text-ink" style={{ paddingRight: HEART_SLOT }}>
          {title}
        </Text>
        <View className="flex-row items-center gap-xs">
          <Icon icon={Calendar} size={18} color="ink-2" />
          <Text className="text-h3 text-ink">{when}</Text>
        </View>
        <View className="flex-row items-center gap-xs">
          <Icon icon={MapPin} size={14} color="ink-2" />
          <Text className="flex-1 text-caption text-ink-2">{where}</Text>
        </View>
        <View className="flex-row flex-wrap items-center gap-sm">
          {event.category && category ? (
            <CategoryPill
              category={event.category}
              label={category}
              icon={CATEGORY_ICON[event.category]}
            />
          ) : null}
          <LanguageTag language={event.language} testID={`event-card-language-${event.id}`} />
          {event.tags.map((tag) => (
            <View key={tag} className="rounded-pill bg-shell px-2.5 py-1">
              <Text className="text-[11px] font-medium text-ink-2">#{tag}</Text>
            </View>
          ))}
        </View>
        {locked ? (
          <View className="flex-row" testID={`event-card-locked-${event.id}`}>
            <View className="flex-row items-center gap-xs rounded-pill border-[0.5px] border-border-soft bg-shell px-2.5 py-1">
              <Icon icon={Lock} size={12} color="ink-2" />
              <Text className="text-[11px] font-medium text-ink-2">
                {t('guest.card.verifiedOnly')}
              </Text>
            </View>
          </View>
        ) : guest && showBadge ? (
          <View
            className="flex-row items-center gap-sm"
            testID={`event-card-guest-host-${event.id}`}
          >
            <Icon icon={ShieldCheck} size={18} color="green-dark" />
            <Text className="shrink text-body font-medium text-ink">
              {t('guest.card.hostedBy')}
            </Text>
            <Badge
              ref={badgeRef}
              kind="badge-green"
              label={t('events.badge.verified')}
              accessibilityLabel={t('events.badge.verifiedA11y')}
              onPress={() => onBadgePress(badgeRef)}
              testID={`event-card-badge-${event.id}`}
            />
          </View>
        ) : hostName && !guest ? (
          <View className="flex-row items-center gap-sm">
            <Avatar name={hostName} seed={host?.id ?? hostName} size="sm" />
            <Text className="text-body font-medium text-ink">{hostName}</Text>
            {showBadge ? (
              <Badge
                ref={badgeRef}
                kind="badge-green"
                label={t('events.badge.verified')}
                accessibilityLabel={t('events.badge.verifiedA11y')}
                onPress={() => onBadgePress(badgeRef)}
                testID={`event-card-badge-${event.id}`}
              />
            ) : null}
          </View>
        ) : null}
        <View className="gap-xs">
          <View className="flex-row items-center gap-xs">
            <Icon icon={Users} size={16} color="ink-2" />
            <Text className="flex-1 text-body font-medium text-ink">{places}</Text>
            {status ? <Badge kind={status.kind} label={status.label} /> : null}
          </View>
          <View
            className="h-1.5 overflow-hidden rounded-pill bg-border-soft"
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            <View
              testID={`event-card-bar-${event.id}`}
              className={`h-1.5 rounded-pill ${full ? 'bg-ink-3' : 'bg-green'}`}
              style={{ width: `${Math.round((full ? 1 : filled) * 100)}%` }}
            />
          </View>
        </View>
        {locked ? (
          <View className="-mx-lg -mb-md mt-xs flex-row items-center gap-sm bg-shell px-lg py-md">
            <Icon icon={Lock} size={16} color="ink" />
            <Text className="flex-1 text-body font-medium text-ink">
              {t('guest.card.lockedCta')}
            </Text>
          </View>
        ) : null}
      </View>
      {/* Reserved 44×44 slot for the wishlist heart (backlog #24): empty in v1. */}
      <View
        testID="event-card-heart-slot"
        pointerEvents="none"
        className="absolute right-0 top-0"
        style={{ width: HEART_SLOT, height: HEART_SLOT }}
      />
    </Pressable>
  );
}
