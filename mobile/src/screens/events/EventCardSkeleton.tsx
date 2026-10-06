import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Skeleton } from '../../components/Skeleton';
import { shadows } from '../../theme/colors';

/** Loading card with the exact Event Card structure (design E1 "Loading"). */
export function EventCardSkeleton() {
  return (
    <View
      className="flex-row overflow-hidden rounded-lg border-[0.5px] border-border-soft bg-surface"
      style={{ boxShadow: shadows.card }}
    >
      <View className="w-1 bg-green-light" />
      <View className="flex-1 gap-sm px-lg py-md">
        <Skeleton width="45%" height={12} />
        <Skeleton width="80%" height={16} />
        <Skeleton width="60%" height={16} />
        <Skeleton width="50%" height={12} />
        <Skeleton width={96} height={28} roundedClassName="rounded-full" />
        <View className="flex-row items-center gap-sm">
          <Skeleton width={24} height={24} roundedClassName="rounded-full" />
          <Skeleton width="35%" height={14} />
        </View>
        <Skeleton width="55%" height={14} />
        <Skeleton height={6} roundedClassName="rounded-pill" />
      </View>
    </View>
  );
}

/** Three loading cards under a day label (design: 3 cards). */
export function EventListSkeleton() {
  const { t } = useTranslation();
  // One element for screen readers that says what is loading (QA BUG-10).
  return (
    <View
      testID="events-loading"
      className="gap-md"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('events.loading')}
    >
      <Skeleton width={140} height={11} />
      <EventCardSkeleton />
      <EventCardSkeleton />
      <EventCardSkeleton />
    </View>
  );
}
