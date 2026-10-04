import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { auth } from '../../api';
import { ApiError } from '../../api/errors';
import { homeFor } from '../../auth/gate';
import { useGate } from '../../auth/GateContext';
import { usePendingEmail } from '../../auth/pendingEmail';
import { useMe } from '../../auth/useMe';
import { useSession } from '../../auth/useSession';
import { Button } from '../../components/Button';
import { MessageScreen } from './layouts';
import { useClearAfterPause } from './rateLimit';
import { UnreachableNotification } from './UnreachableNotification';
import { useSubmitOnce } from './useSubmitOnce';

/** Which email link expired: sign-up / email-change confirmation, or password reset. */
export type ExpiredLinkKind = 'confirm' | 'reset';

/**
 * S4 Link expired (AC-2.2, AC-4.3, AC-13.3): nothing changed, offer a fresh link.
 * - reset: the Forgot password screen (S6) sends a new one;
 * - confirm: sent at once when this device knows the account (logged in, or the email typed
 *   at sign-up), otherwise Log in leads to Check your inbox, which can send it again. On a
 *   logged-in, confirmed phone it was an email-change link: Change my email (A3b) sends a new
 *   one (A06).
 * ("This wasn't me" links can't be sent again: that screen explains it itself.)
 */
export function LinkExpiredScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const gate = useGate();
  const { status, reason } = useSession();
  const pendingEmail = usePendingEmail();
  const me = useMe();
  const { kind } = useLocalSearchParams<{ kind?: ExpiredLinkKind }>();
  const home = gate === 'loading' ? '/' : homeFor(gate, reason);

  const resend = useMutation({
    mutationFn: () =>
      auth().resendConfirmation(status === 'signedIn' ? undefined : (pendingEmail ?? undefined)),
    onSuccess: () => router.replace('/check-inbox'),
  });
  const sendResend = useSubmitOnce(resend);

  // D-6: a 429 disables the button for a while, with a caption under it (no notification).
  const rateLimited = resend.error instanceof ApiError && resend.error.code === 'rate_limited';
  useClearAfterPause(rateLimited, resend.reset);

  const sendNewLink = () => {
    if (kind === 'reset') return router.replace('/forgot-password');
    if (gate === 'ready') {
      // A06: an expired email-change link on a logged-in phone. A new link needs the password
      // again (POST /me/email_change), so Change my email opens with the waiting address
      // (it waits for `me` if it hasn't loaded yet: M-4).
      if (me.data && !me.data.pending_email) return router.replace('/account');
      return router.replace('/account/change-email?resend=1');
    }
    if (status === 'signedIn' || pendingEmail) return sendResend();
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
      {resend.isError && !rateLimited ? (
        <UnreachableNotification onRetry={() => sendResend()} retrying={resend.isPending} />
      ) : null}
      <View className="gap-md">
        <Button
          size="large"
          label={t('linkExpired.action')}
          loading={resend.isPending}
          disabled={rateLimited}
          onPress={sendNewLink}
          testID="new-link"
        />
        {rateLimited ? (
          <Text
            accessibilityLiveRegion="polite"
            className="text-center text-caption text-ink-3"
            testID="rate-limited"
          >
            {t('rateLimited.resend')}
          </Text>
        ) : null}
      </View>
    </MessageScreen>
  );
}
