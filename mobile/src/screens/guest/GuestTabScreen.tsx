import { useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { TextLink } from '../../components/TextLink';
import { MIN_TOUCH_TARGET } from '../../theme/a11y';
import { useGuestAccount } from './useGuestAccount';

export type GuestTab = 'community' | 'market' | 'travel' | 'mySpace';

// Panel colours and emoji (design guest-home section 5). Class names written out for Tailwind.
const PANEL: Record<GuestTab, { bg: string; emoji: string; route: string; soon: boolean }> = {
  // Circles ship in v1: no « Bientôt » (PM decision 2026-10-07).
  community: { bg: 'bg-sky-light', emoji: '🏡', route: 'community', soon: false },
  market: { bg: 'bg-pink-light', emoji: '🔍', route: 'market', soon: true },
  travel: { bg: 'bg-sunny-light', emoji: '🧳', route: 'travel', soon: true },
  mySpace: { bg: 'bg-lavender-light', emoji: '🗓️', route: 'my-space', soon: false },
};

/**
 * Guest tab (AC-15.5, AC-15.6, design guest-home section 5): one shared layout for Cercles,
 * Services, Voyages and Mon espace. The tab name as H1 with "Me connecter", a panel that
 * says what the module does (« Bientôt » except Mon espace), then the green "Créer mon
 * compte", "J'ai déjà un compte" and "Voir les sorties". None of the module's content.
 */
export function GuestTabScreen({ tab }: { tab: GuestTab }) {
  const { t } = useTranslation();
  const router = useRouter();
  const account = useGuestAccount();
  const panel = PANEL[tab];
  const target = { tab: panel.route as 'community' | 'market' | 'travel' | 'my-space' };
  const seeEvents = t('guest.tabs.seeEvents');

  return (
    <SafeAreaView edges={['top']} className="flex-1" testID={`guest-tab-${tab}`}>
      <ScrollView contentContainerClassName="gap-xl px-lg pb-3xl pt-xl">
        <View className="flex-row items-center justify-between gap-md">
          <Text accessibilityRole="header" className="flex-1 text-h1 text-ink">
            {t(`tabs.${tab}`)}
          </Text>
          <TextLink
            label={t('guest.logIn')}
            onPress={() => account.logIn(target)}
            testID="guest-log-in-link"
          />
        </View>
        <ModulePanel tab={tab} />
        <View className="gap-sm">
          <Button
            size="large"
            label={t('guest.createAccount')}
            onPress={() => account.signUp(target)}
            testID="guest-tab-sign-up"
          />
          <Button
            variant="ghost"
            label={t('guest.haveAccount')}
            onPress={() => account.logIn(target)}
            testID="guest-tab-log-in"
          />
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={seeEvents}
            onPress={() => router.navigate('/')}
            className="flex-row items-center justify-center gap-xs"
            style={{ minHeight: MIN_TOUCH_TARGET }}
            testID="guest-tab-see-events"
          >
            <Text className="text-body font-medium text-green-dark">{seeEvents}</Text>
            <Icon icon={ArrowRight} size={16} color="green-dark" />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * What a module does (design guest-home section 5): the module-colour panel with its emoji,
 * « Bientôt » when not built yet, title and body. Shared by the guest tabs and, for members,
 * the coming-soon tabs (Services, Voyages).
 */
export function ModulePanel({ tab }: { tab: GuestTab }) {
  const { t } = useTranslation();
  const panel = PANEL[tab];
  return (
    <View
      className={`items-start gap-md rounded-xl px-xl py-2xl ${panel.bg}`}
      testID={`module-panel-${tab}`}
    >
      <View className="flex-row items-center gap-md">
        <Text
          className="text-[32px]"
          accessible={false}
          importantForAccessibility="no"
          maxFontSizeMultiplier={1}
        >
          {panel.emoji}
        </Text>
        {panel.soon ? <Badge kind="badge-yellow" label={t('guest.hero.soon')} /> : null}
      </View>
      <Text accessibilityRole="header" className="text-h2 text-ink">
        {t(`guest.tabs.${tab}.title`)}
      </Text>
      <Text className="text-body text-ink-2">{t(`guest.tabs.${tab}.body`)}</Text>
    </View>
  );
}
