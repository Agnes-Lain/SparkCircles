import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { auth } from '../../api';
import { homeFor } from '../../auth/gate';
import { useGate } from '../../auth/GateContext';
import { usePendingEmail } from '../../auth/pendingEmail';
import { useSession } from '../../auth/useSession';
import { Button } from '../../components/Button';
import { MessageScreen } from './layouts';
import { UnreachableNotification } from './UnreachableNotification';

/** Which email link expired: sign-up / email-change confirmation, or password reset. */
export type ExpiredLinkKind = 'confirm' | 'reset';

/**
 * S4 Link expired (AC-2.2, AC-4.3, AC-13.3): nothing changed, offer a fresh link.
 * - reset: the Forgot password screen (S6) sends a new one;
 * - confirm: sent at once when this device knows the account (logged in, or the email typed
 *   at sign-up), otherwise Log in leads to Check your inbox, which can send it again.
 * ("This wasn't me" links can't be sent again: that screen explains it itself.)
 */
export function LinkExpiredScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const gate = useGate();
  const { status, reason } = useSession();
  const pendingEmail = usePendingEmail();
  const { kind } = useLocalSearchParams<{ kind?: ExpiredLinkKind }>();
  const home = gate === 'loading' ? '/' : homeFor(gate, reason);

  const resend = useMutation({
    mutationFn: () =>
      auth().resendConfirmation(status === 'signedIn' ? undefined : (pendingEmail ?? undefined)),
    onSuccess: () => router.replace('/check-inbox'),
  });

  const sendNewLink = () => {
    if (kind === 'reset') return router.replace('/forgot-password');
    if (gate === 'ready') return router.replace('/'); // already confirmed: nothing to resend
    if (status === 'signedIn' || pendingEmail) return resend.mutate();
    return router.replace('/log-in');
  };

  return (
    <MessageScreen
      testID="link-expired-screen"
      icon={Clock}
      title={t('linkExpired.title')}
      body={t('linkExpired.body')}
      onBack={() => router.replace(home)}
    >
      {resend.isError ? (
        <UnreachableNotification onRetry={() => resend.mutate()} retrying={resend.isPending} />
      ) : null}
      <View className="gap-md">
        <Button
          size="large"
          label={t('linkExpired.action')}
          loading={resend.isPending}
          onPress={sendNewLink}
          testID="new-link"
        />
      </View>
    </MessageScreen>
  );
}
