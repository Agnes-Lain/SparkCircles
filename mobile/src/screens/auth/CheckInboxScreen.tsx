import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Info, Mail } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { AccessibilityInfo, Platform, Text, View } from 'react-native';

import { auth } from '../../api';
import { ApiError } from '../../api/errors';
import { maskEmail, setPendingEmail, usePendingEmail } from '../../auth/pendingEmail';
import { useLogOut } from '../../auth/useLogOut';
import { useMe } from '../../auth/useMe';
import { useSession } from '../../auth/useSession';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Notification } from '../../components/Notification';
import { TextLink } from '../../components/TextLink';
import { openMailApp } from './external';
import { MessageScreen } from './layouts';
import { UnreachableNotification } from './UnreachableNotification';

/** How long "Send the link again" stays disabled after a resend (design S3: set by the developer). */
export const RESEND_COOLDOWN_MS = 60_000;

/**
 * S3 Check your inbox (AC-1.3, 2.1, 2.3, 2.4): after sign-up, and the only screen an account
 * with an unconfirmed email can see. No tab bar.
 */
export function CheckInboxScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { status } = useSession();
  const me = useMe();
  const pendingEmail = usePendingEmail();
  const logOut = useLogOut();
  const signedIn = status === 'signedIn';
  const email = signedIn ? me.data?.email : pendingEmail;

  const [coolingDown, setCoolingDown] = useState(false);
  useEffect(() => {
    if (!coolingDown) return;
    const timer = setTimeout(() => setCoolingDown(false), RESEND_COOLDOWN_MS);
    return () => clearTimeout(timer);
  }, [coolingDown]);

  const resend = useMutation({
    // Signed in: the API uses the account's email and ignores the body.
    mutationFn: () => auth().resendConfirmation(signedIn ? undefined : (email ?? undefined)),
    onSuccess: () => {
      setCoolingDown(true);
      // TalkBack reads the live region below; VoiceOver needs an announcement.
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(t('checkInbox.resent'));
    },
  });

  const leave = () => {
    if (signedIn) {
      void logOut();
    } else {
      setPendingEmail(null);
      router.replace('/welcome');
    }
  };

  const error = resend.error instanceof ApiError ? resend.error : null;

  return (
    <MessageScreen
      testID="check-inbox-screen"
      icon={Mail}
      title={t('checkInbox.title')}
      body={
        <Text className="text-center text-body text-ink-2">
          {email ? (
            <Trans
              i18nKey="checkInbox.body"
              values={{ email: maskEmail(email) }}
              components={{ b: <Text className="font-medium text-ink" /> }}
            />
          ) : (
            t('checkInbox.bodyNoEmail')
          )}
        </Text>
      }
      footer={<TextLink quiet label={t('common.logOut')} onPress={leave} testID="log-out" />}
    >
      {error?.code === 'rate_limited' ? (
        <Notification level="error" title={error.message} />
      ) : error ? (
        <UnreachableNotification onRetry={() => resend.mutate()} retrying={resend.isPending} />
      ) : null}
      <View className="gap-md">
        <Button size="large" label={t('common.openMailApp')} onPress={() => void openMailApp()} />
        <Button
          size="large"
          variant="ghost"
          label={t('checkInbox.resend')}
          disabled={coolingDown || !email}
          loading={resend.isPending}
          onPress={() => resend.mutate()}
          testID="resend"
        />
        {coolingDown ? (
          <Text
            accessibilityLiveRegion="polite"
            className="text-center text-caption text-ink-3"
            testID="resent"
          >
            {t('checkInbox.resent')}
          </Text>
        ) : null}
      </View>
      <View className="flex-row items-start gap-md rounded-lg border-[0.5px] border-border-soft bg-surface p-lg">
        <View className="h-8 w-8 items-center justify-center rounded-sm bg-shell">
          <Icon icon={Info} size={18} color="ink-2" />
        </View>
        <View className="flex-1 gap-xs">
          <Text className="text-body text-ink">{t('checkInbox.helpTitle')}</Text>
          <Text className="text-caption text-ink-3">{t('checkInbox.helpBody')}</Text>
        </View>
      </View>
    </MessageScreen>
  );
}
