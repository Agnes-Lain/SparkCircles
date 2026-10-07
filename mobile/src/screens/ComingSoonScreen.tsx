import { useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { MIN_TOUCH_TARGET } from '../theme/a11y';
import { ModulePanel } from './guest/GuestTabScreen';

/**
 * Member tab for a module not built yet (Services, Voyages; PM 2026-10-07): the same panel
 * guests see, with « Bientôt », then a link back to the outings. No account actions.
 */
export function ComingSoonScreen({ tab }: { tab: 'market' | 'travel' }) {
  const { t } = useTranslation();
  const router = useRouter();
  const seeEvents = t('guest.tabs.seeEvents');

  return (
    <SafeAreaView edges={['top']} className="flex-1" testID={`coming-soon-${tab}`}>
      <ScrollView contentContainerClassName="gap-xl px-lg pb-3xl pt-xl">
        <Text accessibilityRole="header" className="text-h1 text-ink">
          {t(`tabs.${tab}`)}
        </Text>
        <ModulePanel tab={tab} />
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={seeEvents}
          onPress={() => router.navigate('/')}
          className="flex-row items-center justify-center gap-xs"
          style={{ minHeight: MIN_TOUCH_TARGET }}
          testID="coming-soon-see-events"
        >
          <Text className="text-body font-medium text-green-dark">{seeEvents}</Text>
          <Icon icon={ArrowRight} size={16} color="green-dark" />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
