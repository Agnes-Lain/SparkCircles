import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useIsGuest } from '../../auth/GateContext';
import { Button } from '../../components/Button';
import { SegmentedControl } from '../../components/SegmentedControl';
import { TextLink } from '../../components/TextLink';
import { DiscoverList } from './DiscoverList';
import { MyEvents } from './MyEvents';
import { GuestConversionCard, GuestFooter } from '../guest/GuestFooter';
import { GuestHero } from '../guest/GuestHero';
import { GuestSignUpSheet } from '../guest/GuestSignUpSheet';
import { markHeroSeen, readHeroSeen } from '../guest/heroStore';

type Tab = 'discover' | 'mine';

/**
 * E1 Sorties tab: H1 with the Secondary "Créer ma sortie" (one primary job: open an event),
 * then "À découvrir" / "Mes sorties". `?tab=mine` (the `my-events` link) opens Mes sorties;
 * `?tag=foot` (a tag tapped on an event, AC-3.10) searches that tag.
 */
export function EventsScreen() {
  const params = useLocalSearchParams<{ tag?: string }>();
  // Guest home (US-15, design guest-home section 0): the same Sorties list in guest mode.
  if (useIsGuest()) return <GuestEventsScreen key={params.tag ?? ''} tag={params.tag} />;
  return <MemberEventsScreen />;
}

/**
 * Guest home = Sorties in guest mode (AC-15.1, AC-15.1b): the hero on top (full on the
 * first visit, compact after, a flag kept on the device only), then « Trouve une sortie » with
 * « Créer ma sortie » (opens the sign-up prompt, AC-15.5), the search, the guest cards, the
 * conversion card and the footer. No "Mes sorties", no map button.
 */
function GuestEventsScreen({ tag }: { tag?: string }) {
  const { t } = useTranslation();
  // null while the flag is read; a missing flag shows the full hero (design 3b).
  const [heroSeen, setHeroSeen] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    void readHeroSeen().then((seen) => {
      setHeroSeen(seen);
      if (!seen) void markHeroSeen();
    });
  }, []);

  return (
    <SafeAreaView edges={['top']} className="flex-1" testID="events-screen">
      <DiscoverList
        guest
        initialTag={tag}
        top={(openBadge) => (
          <>
            {heroSeen === null ? null : <GuestHero compact={heroSeen} onVerifyInfo={openBadge} />}
            {/* Guests: a quiet link, not a pill (guest-home "Guest buttons harmonisation"). */}
            <View className="flex-row flex-wrap items-center justify-between gap-md">
              <Text accessibilityRole="header" className="flex-1 text-h2 text-ink">
                {t('guest.searchTitle')}
              </Text>
              <TextLink
                icon={Plus}
                accessibilityRole="button"
                label={t('events.create')}
                onPress={() => setCreating(true)}
                testID="create-event"
              />
            </View>
          </>
        )}
        bottom={
          <>
            <GuestConversionCard />
            <GuestFooter />
          </>
        }
      />
      <GuestSignUpSheet
        visible={creating}
        action="create"
        target={{ create: true }}
        onClose={() => setCreating(false)}
      />
    </SafeAreaView>
  );
}

function MemberEventsScreen() {
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
