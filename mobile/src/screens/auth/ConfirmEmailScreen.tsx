import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
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
import { useToast } from '../../components/ToastProvider';
import { LinkPending } from './LinkPending';
import { UnreachableNotification } from './UnreachableNotification';
import { useLinkToken } from './useLinkToken';

/**
 * Target of the confirmation link (`/confirm-email?token=…`, AC-2.1, 2.2, 13.3, 13.6).
 * - Sign-up link: the device is logged in and lands on Today with the success checkmark and
 *   the toast "Email confirmed. Welcome to SparkCircles!" (design P1).
 * - Email-change link: the toast "Email changed" (My account comes with the next PR).
 * - Expired or used link: S4. Address taken meanwhile (409): the API's message as a toast.
 */
export function ConfirmEmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const token = useLinkToken();
  const queryClient = useQueryClient();
  const { signIn } = useSession();
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
        if (result.user) queryClient.setQueryData(ME_KEY, result.user);
        showToast(t('emailChange.changed'));
      }
      setDone(true);
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) return;
      if (error.code === 'invalid_or_expired_token' || error.code === 'bad_request') {
        router.replace('/link-expired?kind=confirm');
      } else if (error.code === 'email_taken') {
        showToast(error.message, 'error');
        setDone(true);
      }
    },
  });

  // Sent once, when the screen opens.
  useAfterMount(() => {
    if (token) confirm.mutate(token);
    else router.replace('/link-expired?kind=confirm');
  });

  const error = confirm.error instanceof ApiError ? confirm.error : null;
  const offline =
    error && !['invalid_or_expired_token', 'bad_request', 'email_taken'].includes(error.code);

  return (
    <LinkPending>
      {offline && token ? (
        <UnreachableNotification
          onRetry={() => confirm.mutate(token)}
          retrying={confirm.isPending}
        />
      ) : null}
    </LinkPending>
  );
}
