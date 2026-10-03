import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { TextLink } from '../../components/TextLink';
import { Wordmark } from '../../components/Wordmark';
import { currentLocale } from '../../i18n';
import { changeAppLanguage } from '../../i18n/localeStore';

/** S1 Welcome: create an account or log in (design section 3, S1). */
export function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const other = currentLocale() === 'fr' ? 'en' : 'fr';

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-shell px-lg pb-3xl">
      <View className="flex-row justify-end">
        <TextLink
          small
          label={t('welcome.otherLanguage')}
          accessibilityLanguage={other}
          onPress={() => void changeAppLanguage(other)}
          testID="language-switch"
        />
      </View>
      <View className="flex-1 items-center justify-center gap-lg">
        <Wordmark height={40} />
        <Text className="text-center text-body text-ink-2">{t('welcome.tagline')}</Text>
        <Text
          accessible={false}
          importantForAccessibility="no"
          className="text-[32px]"
          maxFontSizeMultiplier={1}
        >
          🦄
        </Text>
      </View>
      <View className="gap-md">
        <Button
          size="large"
          label={t('welcome.createAccount')}
          onPress={() => router.push('/sign-up')}
        />
        <Button
          size="large"
          variant="ghost"
          label={t('welcome.logIn')}
          onPress={() => router.push('/log-in')}
        />
      </View>
    </SafeAreaView>
  );
}
