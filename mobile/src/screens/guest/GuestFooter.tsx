import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { auth } from '../../api';
import { LEGAL_KEY } from '../../api/auth';
import { Button } from '../../components/Button';
import { TextLink } from '../../components/TextLink';
import { useToast } from '../../components/ToastProvider';
import { changeAppLanguage } from '../../i18n/localeStore';
import { shadows } from '../../theme/colors';
import { openLegalDocument } from '../auth/external';
import { useGuestAccount } from './useGuestAccount';

/**
 * Conversion card under the guest results (design guest-home section 3, block 8): the same
 * action as the hero, "Créer mon compte", and the quiet "J'ai déjà un compte".
 */
export function GuestConversionCard() {
  const { t } = useTranslation();
  const account = useGuestAccount();
  return (
    <View
      testID="guest-conversion"
      className="gap-md rounded-lg border-[0.5px] border-border-soft bg-surface p-lg"
      style={{ boxShadow: shadows.card }}
    >
      <Text accessibilityRole="header" className="text-h2 text-ink">
        {t('guest.conversion.title')}
      </Text>
      <Text className="text-body text-ink-2">{t('guest.conversion.body')}</Text>
      <Button
        size="large"
        label={t('guest.createAccount')}
        onPress={() => account.signUp()}
        testID="conversion-sign-up"
      />
      <View className="items-center">
        <TextLink quiet label={t('guest.haveAccount')} onPress={() => account.logIn()} />
      </View>
    </View>
  );
}

/**
 * Footer (design guest-home section 3, block 9): « Confidentialité · Français · English »,
 * which replaces the Welcome language switch (design system section 18).
 */
export function GuestFooter() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const openPrivacy = async () => {
    try {
      const legal = await queryClient.fetchQuery({
        queryKey: LEGAL_KEY,
        queryFn: () => auth().legal(),
        staleTime: 5 * 60_000,
      });
      await openLegalDocument(legal.privacy.url);
    } catch {
      showToast(t('errors.unreachable.title'), 'error');
    }
  };

  const dot = (
    <Text accessible={false} importantForAccessibility="no" className="text-caption text-ink-3">
      ·
    </Text>
  );

  return (
    <View className="flex-row flex-wrap items-center justify-center gap-xs" testID="guest-footer">
      <TextLink small quiet label={t('guest.footer.privacy')} onPress={() => void openPrivacy()} />
      {dot}
      <TextLink
        small
        quiet
        label={t('guest.footer.fr')}
        accessibilityLanguage="fr"
        onPress={() => void changeAppLanguage('fr')}
        testID="footer-fr"
      />
      {dot}
      <TextLink
        small
        quiet
        label={t('guest.footer.en')}
        accessibilityLanguage="en"
        onPress={() => void changeAppLanguage('en')}
        testID="footer-en"
      />
    </View>
  );
}
