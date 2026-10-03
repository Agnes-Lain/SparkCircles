import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Skeleton } from '../../components/Skeleton';

/**
 * Loading state of the email-link screens: a skeleton of the message layout (icon circle,
 * title, two lines), never a lone spinner (design section 3). Screen readers hear "One moment…".
 */
export function LinkPending({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-shell px-lg pb-3xl pt-lg">
      <View className="h-[72px]" />
      <View
        accessible
        accessibilityLabel={t('common.oneMoment')}
        accessibilityRole="progressbar"
        className="items-center gap-lg"
        testID="link-pending"
      >
        <Skeleton width={64} height={64} roundedClassName="rounded-full" />
        <Skeleton width="70%" height={28} />
        <View className="w-full items-center gap-sm">
          <Skeleton width="90%" height={14} />
          <Skeleton width="60%" height={14} />
        </View>
      </View>
      {children ? <View className="mt-xl">{children}</View> : null}
    </SafeAreaView>
  );
}
