import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type TextInput, View } from 'react-native';

import { auth } from '../../api';
import { ApiError } from '../../api/errors';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { Notification } from '../../components/Notification';
import { TextField } from '../../components/TextField';
import { type FieldErrors, looksLikeEmail, useFocusFirstError } from './formErrors';
import { FormScreen } from './layouts';
import { UnreachableNotification } from './UnreachableNotification';
import { useSubmitOnce } from './useSubmitOnce';
import { useBack } from './useBack';

/** S6 Forgot password (AC-4.1). The next screen is the same whether the account exists or not. */
export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const back = useBack('/log-in');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors<'email'>>({});
  const emailRef = useRef<TextInput>(null);
  const focusFirstError = useFocusFirstError(['email'] as const, { email: emailRef });

  const request = useMutation({
    mutationFn: () => auth().requestPasswordReset(email.trim()),
    onSuccess: () => router.replace('/link-sent'),
  });
  const sendRequest = useSubmitOnce(request);

  const submit = () => {
    const next: FieldErrors<'email'> = looksLikeEmail(email)
      ? {}
      : { email: t('fieldErrors.email') };
    setErrors(next);
    if (next.email) return focusFirstError(next);
    sendRequest();
  };

  const error = request.error instanceof ApiError ? request.error : null;

  return (
    <FormScreen testID="forgot-password-screen">
      <Header title={t('forgotPassword.title')} onBack={back} intro={t('forgotPassword.intro')} />
      {error?.code === 'rate_limited' ? (
        // D-6: same words whether or not the account exists (AC-4.1).
        <Notification
          level="error"
          title={t('rateLimited.title')}
          caption={t('rateLimited.forgotPassword')}
          testID="rate-limited"
        />
      ) : error ? (
        <UnreachableNotification onRetry={submit} retrying={request.isPending} />
      ) : null}
      <TextField
        ref={emailRef}
        testID="email"
        label={t('logIn.email')}
        kind="email"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          if (errors.email) setErrors({});
        }}
        error={errors.email}
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      <View>
        <Button
          size="large"
          label={t('forgotPassword.submit')}
          loading={request.isPending}
          onPress={submit}
          testID="submit"
        />
      </View>
    </FormScreen>
  );
}
