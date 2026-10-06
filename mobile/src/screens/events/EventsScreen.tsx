import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { SegmentedControl } from '../../components/SegmentedControl';
import { DiscoverList } from './DiscoverList';
import { MyEvents } from './MyEvents';

type Tab = 'discover' | 'mine';

/**
 * E1 Sorties tab: H1 with the Secondary "Créer ma sortie" (one primary job: open an event),
 * then "À découvrir" / "Mes sorties". `?tab=mine` (the `my-events` link) opens Mes sorties;
 * `?tag=foot` (a tag tapped on an event, AC-3.10) searches that tag.
 */
export function EventsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; tag?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'mine' ? 'mine' : 'discover');
  // A new link (my-events) or a tapped tag switches the segment, once per new parameter.
  const [seen, setSeen] = useState({ tab: params.tab, tag: params.tag });
  if (seen.tab !== params.tab || seen.tag !== params.tag) {
    setSeen({ tab: params.tab, tag: params.tag });
    if (params.tag) setTab('discover');
    else if (params.tab === 'mine') setTab('mine');
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1" testID="events-screen">
      <View className="gap-md px-lg pb-md pt-xl">
        <View className="flex-row items-center justify-between gap-md">
          <Text accessibilityRole="header" className="flex-1 text-h1 text-ink">
            {t('events.title')}
          </Text>
          <Button
            variant="secondary"
            size="small"
            icon={Plus}
            label={t('events.create')}
            onPress={() => router.push('/events/new')}
            testID="create-event"
          />
        </View>
        <SegmentedControl
          segments={[
            { key: 'discover', label: t('events.segment.discover') },
            { key: 'mine', label: t('events.segment.mine') },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>
      {tab === 'discover' ? (
        <DiscoverList key={params.tag ?? ''} initialTag={params.tag} />
      ) : (
        <MyEvents />
      )}
    </SafeAreaView>
  );
}
