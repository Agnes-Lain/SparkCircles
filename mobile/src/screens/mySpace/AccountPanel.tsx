import { useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useRouter } from 'expo-router';
import {
  Download,
  Eye,
  FileText,
  Globe,
  Lock,
  LogOut,
  Mail,
  ShieldCheck,
  User,
  UserCog,
} from 'lucide-react-native';
import { type RefObject, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { account, auth } from '../../api';
import { LEGAL_KEY } from '../../api/auth';
import type { Me } from '../../api/types';
import { maskEmail } from '../../auth/pendingEmail';
import { useLogOut } from '../../auth/useLogOut';
import { ME_KEY } from '../../auth/useMe';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { RadioRow } from '../../components/RadioRow';
import { SettingsList } from '../../components/SettingsList';
import { TextLink } from '../../components/TextLink';
import { useToast } from '../../components/ToastProvider';
import { type Locale, resolveLocale } from '../../i18n';
import { formatDate } from '../../i18n/format';
import { changeAppLanguage } from '../../i18n/localeStore';
import { shadows } from '../../theme/colors';
import { BadgeSheet } from '../account/BadgeSheet';
import {
  ownerBadge,
  type OwnerVerificationState,
  ownerVerificationState,
} from '../account/verification';
import { openLegalDocument } from '../auth/external';

/** "Claire M.": the name as others see it (first name + last-name initial, AC-6.1). */
export function publicName(firstName: string, lastName: string): string {
  const initial = lastName.trim().charAt(0).toUpperCase();
  return initial ? `${firstName} ${initial}.` : firstName;
}

/**
 * The « Mon compte » dot (design my-space 1): verification to start, redo or renew, an e-mail
 * change waiting, terms to accept. The matching row says it in words too.
 */
export function accountNeedsAttention(me: Me): boolean {
  const state = ownerVerificationState(me.verification);
  const verificationToDo =
    !me.verification.renewal &&
    (state === 'notVerified' ||
      state === 'rejected' ||
      state === 'expired' ||
      state === 'revoked' ||
      state === 'expiresSoon');
  return verificationToDo || Boolean(me.pending_email) || me.terms_acceptance_required;
}

/** The Verification row's status in words (Vérifiée / À faire / En cours). */
function verificationRowCaption(state: OwnerVerificationState, me: Me, t: TFunction): string {
  if (state === 'pending' || me.verification.renewal?.status === 'pending')
    return t('mySpace.account.rowInProgress');
  if (state === 'verified') return t('mySpace.account.rowVerified');
  return t('mySpace.account.rowToDo');
}

/**
 * « Mon compte » inside My space (spec AC-7.1, design my-space 3): profile card, grouped
 * rows (same screens and rules as before, AC-7.2), language sheet, log out, and « Fermer mon
 * compte » last.
 */
export function AccountPanel({ me }: { me: Me }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const logOut = useLogOut();
  const locale = resolveLocale(i18n.language);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sheet, setSheet] = useState<'badge' | 'language' | 'legal' | null>(null);
  const badgeRef = useRef<View>(null);
  const opener = useRef<View | null>(null);
  const open = (which: 'badge' | 'language' | 'legal', from?: RefObject<View | null>) => {
    opener.current = from?.current ?? null;
    setSheet(which);
  };

  const state = ownerVerificationState(me.verification);
  const badge = ownerBadge(state, t);
  const valid = me.verification.verified && me.verification.expires_on;
  const status = valid
    ? t('mySpace.account.statusValid', { date: formatDate(me.verification.expires_on!, locale) })
    : state === 'pending'
      ? t('mySpace.verify.pending')
      : t('mySpace.account.statusVerify');

  const chooseLanguage = async (choice: Locale) => {
    setSheet(null);
    if (choice === locale) return;
    // Applies at once and on this phone even offline; the account keeps it for next time.
    await changeAppLanguage(choice);
    try {
      const updated = await account().updateProfile({ locale: choice });
      queryClient.setQueryData(ME_KEY, updated);
    } catch {
      // The phone keeps the choice; the account is updated next time it is changed.
    }
  };

  const openLegal = async (which: 'terms' | 'privacy') => {
    setSheet(null);
    try {
      const legal = await queryClient.fetchQuery({
        queryKey: LEGAL_KEY,
        queryFn: () => auth().legal(),
        staleTime: 5 * 60_000,
      });
      await openLegalDocument(legal[which].url);
    } catch {
      showToast(t('errors.unreachable.title'), 'error');
    }
  };

  return (
    <View className="gap-xl" testID="account-panel">
      <View
        className="flex-row items-center gap-lg rounded-lg border-[0.5px] border-border-soft bg-surface p-lg"
        style={{ boxShadow: shadows.card }}
        testID="profile-card"
      >
        <Avatar name={me.first_name} seed={me.id} size="xl" />
        <View className="flex-1 gap-xs">
          <Text accessibilityRole="header" className="text-h2 text-ink">
            {publicName(me.first_name, me.last_name)}
          </Text>
          <View className="flex-row">
            <Badge
              ref={badgeRef}
              kind={badge.kind}
              label={badge.label}
              accessibilityLabel={
                me.verification.verified && !me.verification.expires_soon
                  ? t('badge.verifiedA11y')
                  : t('badge.opensExplanation', { status: badge.label })
              }
              onPress={() => open('badge', badgeRef)}
              testID="owner-badge"
            />
          </View>
          <Text className="text-caption text-ink-2">{status}</Text>
        </View>
      </View>

      <SettingsList
        title={t('mySpace.account.groupProfile')}
        items={[
          {
            key: 'preview',
            icon: Eye,
            label: t('mySpace.account.howOthersSee'),
            onPress: () => router.push('/account/profile-preview'),
            testID: 'row-preview',
          },
          {
            key: 'edit',
            icon: User,
            label: t('mySpace.account.editProfile'),
            onPress: () => router.push('/account/edit-profile'),
            testID: 'row-edit',
          },
        ]}
      />
      <SettingsList
        title={t('mySpace.account.groupAccount')}
        items={[
          {
            key: 'verification',
            icon: ShieldCheck,
            iconTone: 'verification',
            label: t('mySpace.account.verification'),
            caption: verificationRowCaption(state, me, t),
            captionTone:
              accountNeedsAttention(me) && !me.pending_email && !me.terms_acceptance_required
                ? 'attention'
                : 'default',
            onPress: () => router.push('/verification'),
            testID: 'row-verification',
          },
          {
            key: 'email',
            icon: Mail,
            label: t('mySpace.account.email'),
            caption: me.pending_email ? t('mySpace.account.rowEmailPending') : maskEmail(me.email),
            captionTone: me.pending_email ? 'attention' : 'default',
            onPress: () =>
              router.push(
                me.pending_email ? '/account/change-email?resend=1' : '/account/change-email',
              ),
            testID: 'row-email',
          },
          {
            key: 'security',
            icon: Lock,
            label: t('mySpace.account.security'),
            onPress: () => router.push('/account/security'),
            testID: 'row-security',
          },
        ]}
      />
      <SettingsList
        title={t('mySpace.account.groupData')}
        items={[
          {
            key: 'privacy',
            icon: UserCog,
            label: t('mySpace.account.privacy'),
            onPress: () => router.push('/account/privacy'),
            testID: 'row-privacy',
          },
          {
            key: 'data',
            icon: Download,
            label: t('mySpace.account.data'),
            onPress: () => router.push('/my-data'),
            testID: 'row-data',
          },
          {
            key: 'language',
            icon: Globe,
            label: t('mySpace.account.language'),
            caption: locale === 'fr' ? t('mySpace.account.french') : t('mySpace.account.english'),
            onPress: () => open('language'),
            testID: 'row-language',
          },
        ]}
      />
      <SettingsList
        title={t('mySpace.account.groupAbout')}
        items={[
          {
            key: 'legal',
            icon: FileText,
            label: t('mySpace.account.legal'),
            onPress: () => open('legal'),
            testID: 'row-legal',
          },
        ]}
      />

      <View className="gap-xl">
        <Button
          variant="ghost"
          icon={LogOut}
          label={t('common.logOut')}
          loading={loggingOut}
          onPress={() => {
            setLoggingOut(true);
            // AC-3.5: ends on Sorties in guest mode with the toast, as from the former A1
            // screen (My space stays reachable to guests, so the gate wouldn't move the device).
            void logOut().then(() => router.replace('/'));
          }}
          testID="log-out"
        />
        <View className="items-center">
          <TextLink
            quiet
            label={t('account.close')}
            onPress={() => router.push('/close-account')}
            testID="close-account"
          />
        </View>
      </View>

      <BadgeSheet
        verified={me.verification.verified}
        visible={sheet === 'badge'}
        onClose={() => setSheet(null)}
        returnFocusTo={opener}
      />
      <BottomSheet
        visible={sheet === 'language'}
        onClose={() => setSheet(null)}
        testID="language-sheet"
      >
        <View className="gap-sm">
          <Text accessibilityRole="header" className="text-h2 text-ink">
            {t('mySpace.account.languageTitle')}
          </Text>
          <View accessibilityRole="radiogroup">
            <RadioRow
              label={t('mySpace.account.french')}
              selected={locale === 'fr'}
              onPress={() => void chooseLanguage('fr')}
              testID="language-fr"
            />
            <RadioRow
              label={t('mySpace.account.english')}
              selected={locale === 'en'}
              onPress={() => void chooseLanguage('en')}
              testID="language-en"
            />
          </View>
        </View>
      </BottomSheet>
      <BottomSheet visible={sheet === 'legal'} onClose={() => setSheet(null)} testID="legal-sheet">
        <View className="gap-md">
          <Text accessibilityRole="header" className="text-h2 text-ink">
            {t('mySpace.account.legal')}
          </Text>
          <SettingsList
            items={[
              {
                key: 'terms',
                icon: FileText,
                label: t('mySpace.account.terms'),
                onPress: () => void openLegal('terms'),
                testID: 'legal-terms',
              },
              {
                key: 'privacy-policy',
                icon: FileText,
                label: t('mySpace.account.privacyPolicy'),
                onPress: () => void openLegal('privacy'),
                testID: 'legal-privacy',
              },
            ]}
          />
        </View>
      </BottomSheet>
    </View>
  );
}
