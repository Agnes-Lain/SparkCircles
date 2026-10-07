import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import type { MemberCircle } from '../../api/circles';
import { Badge } from '../../components/Badge';
import { resolveLocale } from '../../i18n';
import { formatShortDay, formatTime } from '../events/format';
import { Card, VerifiedBadge } from './CircleParts';
import { displayName } from './queries';

/** « Sorties du cercle » (AC-16.4): the next outing, then the circle-only outings. */
export function CircleOutings({ circle }: { circle: MemberCircle }) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const router = useRouter();
  const next = circle.next_event;
  return (
    <View className="gap-sm" testID="circle-outings">
      <Text className="text-label uppercase text-ink-2">{t('circles.detail.outings')}</Text>
      {next ? (
        <View accessible className="gap-xs">
          <Text className="text-caption text-ink-2">{t('circles.detail.nextOuting')}</Text>
          <Text className="text-data text-ink">{formatTime(next.starts_at, next.time_zone)}</Text>
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
    </View>
  );
}
