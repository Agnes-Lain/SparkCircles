import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, type TextInput, View } from 'react-native';

import { auth } from '../../api';
import { ApiError } from '../../api/errors';
import { deviceName } from '../../auth/deviceName';
import { ME_KEY } from '../../auth/useMe';
import { useAfterMount } from '../../auth/useAfterMount';
import { useLeaveWhenGateMoves } from '../../auth/useLeaveWhenGateMoves';
import { useSession } from '../../auth/useSession';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { Notification } from '../../components/Notification';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import {
  confirmationMismatch,
  type FieldErrors,
  MIN_PASSWORD_LENGTH,
  useFocusFirstError,
} from './formErrors';
import { FormScreen } from './layouts';
import { UnreachableNotification } from './UnreachableNotification';
import { useSubmitOnce } from './useSubmitOnce';
import { useLinkToken } from './useLinkToken';

/**
 * S8 New password, opened from the reset link (AC-4.2, 4.3): every other device is logged
 * out, this one is logged in. An expired or used link leads to S4. The password is typed
 * twice (backlog #42): the API still gets it once.
 */
type Field = 'password' | 'confirmation';
const FIELDS: readonly Field[] = ['password', 'confirmation'];

export function NewPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const token = useLinkToken();
  const queryClient = useQueryClient();
  const { signIn } = useSession();
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [done, setDone] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const confirmationRef = useRef<TextInput>(null);
  const focusFirstError = useFocusFirstError(FIELDS, {
    password: passwordRef,
    confirmation: confirmationRef,
  });
  useLeaveWhenGateMoves(done);

  useAfterMount(() => {
    if (!token) router.replace('/link-expired?kind=reset');
  });

  const reset = useMutation({
    mutationFn: () => auth().resetPassword(token ?? '', password, deviceName()),
    onSuccess: async ({ token: deviceToken, user }) => {
      queryClient.setQueryData(ME_KEY, user);
      await signIn(deviceToken);
      showToast(t('newPassword.changed'));
      setDone(true);
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) return;
      if (error.code === 'invalid_or_expired_token') router.replace('/link-expired?kind=reset');
      if (error.code === 'validation_failed') {
        const next = { password: t('fieldErrors.password') };
        setErrors(next);
        focusFirstError(next);
      }
    },
  });
  const sendReset = useSubmitOnce(reset);

  const submit = () => {
    if (done) return; // the link is used: a second send would only find it expired
    const next: FieldErrors<Field> = {};
    if (password.length < MIN_PASSWORD_LENGTH) next.password = t('fieldErrors.password');
    if (confirmationMismatch(password, confirmation, true)) {
      next.confirmation = t('fieldErrors.passwordMismatch');
    }
    setErrors(next);
    if (next.password || next.confirmation) return focusFirstError(next);
    sendReset();
  };

  const error = reset.error instanceof ApiError ? reset.error : null;
  const bannerError =
    error && !['invalid_or_expired_token', 'validation_failed'].includes(error.code) ? error : null;

  return (
    <FormScreen testID="new-password-screen">
      <Header title={t('newPassword.title')} />
      {bannerError?.code === 'rate_limited' ? (
        <Notification level="error" title={bannerError.message} />
      ) : bannerError ? (
        <UnreachableNotification onRetry={submit} retrying={reset.isPending} />
      ) : null}
      <TextField
        ref={passwordRef}
        testID="password"
        label={t('newPassword.label')}
        kind="newPassword"
        helper={t('signUp.passwordHelper')}
        placeholder={t('signUp.passwordPlaceholder')}
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          if (errors.password) setErrors({ ...errors, password: undefined });
        }}
        error={errors.password}
        returnKeyType="next"
        onSubmitEditing={() => confirmationRef.current?.focus()}
      />
      <TextField
        ref={confirmationRef}
        testID="password-confirmation"
        label={t('newPassword.confirmLabel')}
        kind="newPassword"
        value={confirmation}
        onChangeText={(value) => {
          setConfirmation(value);
          if (errors.confirmation) setErrors({ ...errors, confirmation: undefined });
        }}
        error={
          errors.confirmation ??
          (confirmationMismatch(password, confirmation)
            ? t('fieldErrors.passwordMismatch')
            : undefined)
        }
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <View className="gap-sm">
        <Button
          size="large"
          label={t('newPassword.submit')}
          loading={reset.isPending || done}
          onPress={submit}
          testID="submit"
        />
        <Text className="text-center text-caption text-ink-3">{t('newPassword.caption')}</Text>
      </View>
    </FormScreen>
  );
}
