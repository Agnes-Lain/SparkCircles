import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useIsGuest } from '../../auth/GateContext';
import { SegmentedControl } from '../../components/SegmentedControl';
import { TextLink } from '../../components/TextLink';
import { useGuestAccount } from '../guest/useGuestAccount';
import { FindCircles } from './FindCircles';
import { GuestCirclesPanel, MyCirclesList } from './MyCircles';

type Tab = 'mine' | 'find';

/**
 * C1 Cercles tab (design sections 4 and 11): H1, the "Mes cercles | Trouver un cercle"
 * segmented control (sky) on every state, guests included (AC-8.1, AC-17.10). `?tab=find`
 * opens the search.
 */
export function CirclesScreen() {
  const { t } = useTranslation();
  const guest = useIsGuest();
  const account = useGuestAccount();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'find' ? 'find' : 'mine');

  return (
    <SafeAreaView edges={['top']} className="flex-1" testID="circles-screen">
      <View className="gap-md px-lg pb-md pt-xl">
        <View className="flex-row items-center justify-between gap-md">
          <Text accessibilityRole="header" className="flex-1 text-h1 text-ink">
            {t('circles.title')}
          </Text>
          {guest ? (
            <TextLink
              label={t('guest.logIn')}
              onPress={() => account.logIn({ tab: 'community' })}
              testID="guest-log-in-link"
            />
          ) : null}
        </View>
        <SegmentedControl
          module="community"
          testIDPrefix="circles-segment"
          segments={[
            { key: 'mine', label: t('circles.segment.mine') },
            { key: 'find', label: t('circles.segment.find') },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>
      {tab === 'find' ? (
        <FindCircles guest={guest} />
      ) : guest ? (
        <GuestCirclesPanel />
      ) : (
        <MyCirclesList />
      )}
    </SafeAreaView>
  );
}
