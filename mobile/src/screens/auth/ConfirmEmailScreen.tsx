import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { CircleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { auth } from '../../api';
import { ApiError } from '../../api/errors';
import { deviceName } from '../../auth/deviceName';
import { setPendingEmail } from '../../auth/pendingEmail';
import { ME_KEY } from '../../auth/useMe';
import { useAfterMount } from '../../auth/useAfterMount';
import { useLeaveWhenGateMoves } from '../../auth/useLeaveWhenGateMoves';
import { useSession } from '../../auth/useSession';
import { Button } from '../../components/Button';
import { useToast } from '../../components/ToastProvider';
import { MessageScreen } from './layouts';
import { LinkPending } from './LinkPending';
import { UnreachableNotification } from './UnreachableNotification';
import { useSubmitOnce } from './useSubmitOnce';
import { useLinkToken } from './useLinkToken';

/**
 * Target of the confirmation link (`/confirm-email?token=…`, AC-2.1, 2.2, 13.3, 13.6).
 * - Sign-up link: the device is logged in and lands on Today with the success checkmark and
 *   the toast "Email confirmed. Welcome to SparkCircles!" (design P1).
 * - Email-change link: My account with the toast "Email changed" (design A3b) when this phone
 *   is logged in, otherwise wherever the gate sends it.
 * - Expired or used link: S4. Address taken meanwhile (409, AC-13.6): a full screen (D-7) that
 *   never says another account uses the address (AC-13.5).
 */
export function ConfirmEmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const token = useLinkToken();
  const queryClient = useQueryClient();
  const { signIn, status } = useSession();
  const { showToast, celebrate } = useToast();
  const [done, setDone] = useState(false);
  useLeaveWhenGateMoves(done);

  const confirm = useMutation({
    mutationFn: (value: string) => auth().confirmEmail(value, deviceName()),
    onSuccess: async (result) => {
      if (result.token) {
        queryClient.setQueryData(ME_KEY, result.user);
        await signIn(result.token);
        setPendingEmail(null);
        celebrate();
        showToast(t('checkInbox.confirmed'));
      } else {
        showToast(t('emailChange.changed'));
        if (result.user) {
          queryClient.setQueryData(ME_KEY, result.user);
          router.replace('/account');
          return;
        }
      }
      setDone(true);
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) return;
      if (error.code === 'invalid_or_expired_token' || error.code === 'bad_request') {
        router.replace('/link-expired?kind=confirm');
      }
    },
  });
  const sendConfirm = useSubmitOnce(confirm);

  // Sent once, when the screen opens.
  useAfterMount(() => {
    if (token) sendConfirm(token);
    else router.replace('/link-expired?kind=confirm');
  });

  const error = confirm.error instanceof ApiError ? confirm.error : null;
  const offline =
    error && !['invalid_or_expired_token', 'bad_request', 'email_taken'].includes(error.code);

  if (error?.code === 'email_taken') {
    // D-7: OK → My account when logged in, Welcome otherwise.
    return (
      <MessageScreen
        testID="email-change-failed-screen"
        icon={CircleAlert}
        title={t('emailChange.takenTitle')}
        body={t('emailChange.takenBody')}
      >
        <Button
          size="large"
          label={t('common.ok')}
          onPress={() => router.replace(status === 'signedIn' ? '/account' : '/welcome')}
          testID="ok"
        />
      </MessageScreen>
    );
  }

  return (
    <LinkPending>
      {offline && token ? (
        <UnreachableNotification onRetry={() => sendConfirm(token)} retrying={confirm.isPending} />
      ) : null}
    </LinkPending>
  );
}
