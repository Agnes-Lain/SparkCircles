import { useRouter } from 'expo-router';
import { Download, Eye, Lock, LogOut, Mail, ShieldCheck, User } from 'lucide-react-native';
import { type RefObject, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { maskEmail } from '../../auth/pendingEmail';
import { useLogOut } from '../../auth/useLogOut';
import { useMe } from '../../auth/useMe';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { IconSquare } from '../../components/IconSquare';
import { SettingsList } from '../../components/SettingsList';
import { Skeleton } from '../../components/Skeleton';
import { TextLink } from '../../components/TextLink';
import { currentLocale } from '../../i18n';
import { FormScreen } from '../auth/layouts';
import { UnreachableNotification } from '../auth/UnreachableNotification';
import { useBack } from '../auth/useBack';
import { BadgeSheet } from './BadgeSheet';
import {
  ownerBadge,
  ownerVerificationState,
  verificationCard,
  verificationCardAction,
} from './verification';

/** "Claire M.": the name as others see it (first name + last-name initial, AC-6.1). */
export function publicName(firstName: string, lastName: string): string {
  const initial = lastName.trim().charAt(0).toUpperCase();
  return initial ? `${firstName} ${initial}.` : firstName;
}

/**
 * A1 My account (AC-3.5, 6.3, 7.5, 11.1, 12.1): header with the owner's verification badge,
 * the verification card by status, the settings list, "Log out" and "Close my account".
 * The card's button opens V0 (verify) or V5 ("See details"); "What this means" opens B1.
 */
export function AccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const back = useBack('/my-space');
  const me = useMe();
  const logOut = useLogOut();
  const [loggingOut, setLoggingOut] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The badge and "What this means" both open B1; focus returns to the one used (M-5).
  const badgeRef = useRef<View>(null);
  const linkRef = useRef<View>(null);
  const sheetOpener = useRef<View>(null);
  const openSheet = (from: RefObject<View | null>) => {
    sheetOpener.current = from.current;
    setSheetOpen(true);
  };

  const onLogOut = async () => {
    setLoggingOut(true);
    await logOut();
  };

  if (!me.data) {
    return (
      <FormScreen testID="account-screen">
        <Header title={t('account.title')} onBack={back} />
        {me.isError ? (
          <UnreachableNotification onRetry={() => void me.refetch()} retrying={me.isFetching} />
        ) : (
          <AccountSkeleton />
        )}
      </FormScreen>
    );
  }

  const user = me.data;
  const state = ownerVerificationState(user.verification);
  const badge = ownerBadge(state, t);
  const card = verificationCard(user.verification, state, t, currentLocale());
  const action = verificationCardAction(user.verification, state, t);

  return (
    <FormScreen testID="account-screen">
      <Header title={t('account.title')} onBack={back} />

      <View className="flex-row items-center gap-md">
        <Avatar name={user.first_name} seed={user.id} />
        <View className="flex-1 gap-xs">
          <View className="flex-row flex-wrap items-center gap-sm">
            <Text className="text-h2 text-ink">{publicName(user.first_name, user.last_name)}</Text>
            <Badge
              ref={badgeRef}
              kind={badge.kind}
              label={badge.label}
              accessibilityLabel={
                user.verification.verified && !user.verification.expires_soon
                  ? t('badge.verifiedA11y')
                  : t('badge.opensExplanation', { status: badge.label })
              }
              onPress={() => openSheet(badgeRef)}
              testID="owner-badge"
            />
          </View>
          <Text className="text-caption text-ink-3">{maskEmail(user.email)}</Text>
        </View>
      </View>

      <View
        className="gap-md rounded-lg border-[0.5px] border-border-soft bg-surface p-lg"
        testID="verification-card"
      >
        <View className="flex-row items-start gap-md">
          <IconSquare icon={ShieldCheck} tone="verification" />
          <View className="flex-1 gap-xs">
            <Text accessibilityRole="header" className="text-h3 text-ink">
              {card.title}
            </Text>
            {card.body ? <Text className="text-body text-ink-2">{card.body}</Text> : null}
            {card.caption ? <Text className="text-caption text-ink-3">{card.caption}</Text> : null}
          </View>
        </View>
        {action ? (
          <View className="items-start">
            <Button
              variant={action.variant}
              label={action.label}
              onPress={() => router.push(action.href)}
              testID="verification-action"
            />
          </View>
        ) : null}
        {state === 'verified' ? (
          <View className="items-start">
            <TextLink
              ref={linkRef}
              label={t('verificationCard.whatThisMeans')}
              onPress={() => openSheet(linkRef)}
            />
          </View>
        ) : null}
      </View>

      <SettingsList
        title={t('account.sectionProfile')}
        items={[
          {
            key: 'preview',
            icon: Eye,
            label: t('account.howOthersSee'),
            onPress: () => router.push('/account/profile-preview'),
            testID: 'row-preview',
          },
          {
            key: 'edit',
            icon: User,
            label: t('account.editProfile'),
            onPress: () => router.push('/account/edit-profile'),
            testID: 'row-edit',
          },
          {
            key: 'privacy',
            icon: Mail,
            label: t('account.privacy'),
            onPress: () => router.push('/account/privacy'),
            testID: 'row-privacy',
          },
          {
            key: 'security',
            icon: Lock,
            label: t('account.security'),
            onPress: () => router.push('/account/security'),
            testID: 'row-security',
          },
          {
            key: 'data',
            icon: Download,
            label: t('account.data'),
            onPress: () => router.push('/my-data'),
            testID: 'row-data',
          },
        ]}
      />

      <View className="items-center gap-sm">
        <Button
          variant="ghost"
          icon={LogOut}
          label={t('common.logOut')}
          loading={loggingOut}
          onPress={() => void onLogOut()}
          testID="log-out"
        />
        <TextLink
          quiet
          label={t('account.close')}
          onPress={() => router.push('/close-account')}
          testID="close-account"
        />
      </View>

      <BadgeSheet
        verified={user.verification.verified}
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        returnFocusTo={sheetOpener}
      />
    </FormScreen>
  );
}

/** A1 loading: skeleton of the header, the card and the 5 rows. */
function AccountSkeleton() {
  const { t } = useTranslation();
  return (
    <View
      accessible
      accessibilityLabel={t('common.oneMoment')}
      className="gap-xl"
      testID="account-loading"
    >
      <View className="flex-row items-center gap-md">
        <Skeleton width={44} height={44} roundedClassName="rounded-full" />
        <View className="flex-1 gap-sm">
          <Skeleton width="50%" height={18} />
          <Skeleton width="40%" height={12} />
        </View>
      </View>
      <View className="gap-md rounded-lg border-[0.5px] border-border-soft bg-surface p-lg">
        <Skeleton width="70%" height={16} />
        <Skeleton width="90%" height={12} />
        <Skeleton width="60%" height={12} />
      </View>
      <View className="rounded-lg border-[0.5px] border-border-soft bg-surface px-lg">
        {[0, 1, 2, 3, 4].map((row) => (
          <View key={row} className="min-h-[52px] flex-row items-center gap-md">
            <Skeleton width={32} height={32} />
            <Skeleton width="55%" height={14} />
          </View>
        ))}
      </View>
    </View>
  );
}
