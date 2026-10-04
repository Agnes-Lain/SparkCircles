import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Text, type TextInput, View } from 'react-native';

import { account } from '../../api';
import { ApiError } from '../../api/errors';
import { maskEmail } from '../../auth/pendingEmail';
import { ME_KEY, useMe } from '../../auth/useMe';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { Notification } from '../../components/Notification';
import { TextField } from '../../components/TextField';
import { openMailApp } from '../auth/external';
import { type FieldErrors, looksLikeEmail, useFocusFirstError } from '../auth/formErrors';
import { FormScreen, MessageScreen } from '../auth/layouts';
import { UnreachableNotification } from '../auth/UnreachableNotification';
import { useBack } from '../auth/useBack';
import { useSubmitOnce } from '../auth/useSubmitOnce';

type Field = 'email' | 'password';
const ORDER = ['email', 'password'] as const;

/**
 * A3b Change my email (AC-13.1, 13.2, 13.4, 13.5). The success screen is the same whether or
 * not the new address belongs to another account. "Send the link again" (A3, `?resend=1`) and
 * an expired email-change link on a logged-in phone (A06) open it with the waiting address
 * filled in: sending a new link needs the password again (POST /me/email_change).
 */
export function ChangeEmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const back = useBack('/account/edit-profile');
  const queryClient = useQueryClient();
  const me = useMe();
  const { resend } = useLocalSearchParams<{ resend?: string }>();
  const [email, setEmail] = useState(() => (resend ? (me.data?.pending_email ?? '') : ''));
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [sentTo, setSentTo] = useState<string | null>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const refs = { email: emailRef, password: passwordRef };
  const focusFirstError = useFocusFirstError(ORDER, refs);

  const request = useMutation({
    mutationFn: (vars: { email: string; password: string }) =>
      account().requestEmailChange(vars.email, vars.password),
    onSuccess: (_, vars) => {
      setSentTo(vars.email);
      void queryClient.invalidateQueries({ queryKey: ME_KEY }); // shows the waiting address in A3
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) return;
      let next: FieldErrors<Field> = {};
      if (error.code === 'invalid_password') {
        next = { password: t('fieldErrors.passwordMismatch') };
      } else if (error.code === 'validation_failed') {
        const keys = error.details?.email ?? [];
        next = {
          email: keys.includes('same_as_current')
            ? t('changeEmail.sameEmail')
            : t('fieldErrors.email'),
        };
      }
      if (Object.keys(next).length === 0) return;
      setErrors(next);
      focusFirstError(next);
    },
  });
  const sendRequest = useSubmitOnce(request);

  const submit = () => {
    const next: FieldErrors<Field> = {};
    const trimmed = email.trim().toLowerCase();
    if (!looksLikeEmail(trimmed)) next.email = t('fieldErrors.email');
    else if (me.data && trimmed === me.data.email.toLowerCase()) {
      next.email = t('changeEmail.sameEmail');
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return focusFirstError(next);
    // No designed copy for an empty password: the password field takes the focus.
    if (!password) return passwordRef.current?.focus();
    sendRequest({ email: trimmed, password });
  };

  if (sentTo) {
    return (
      <MessageScreen
        testID="email-change-sent-screen"
        icon={Mail}
        title={t('changeEmail.sentTitle')}
        onBack={() => router.replace('/account')}
        body={
          <Text className="text-center text-body text-ink-2">
            <Trans
              i18nKey="changeEmail.sentBody"
              values={{ email: maskEmail(sentTo) }}
              components={{ b: <Text className="font-medium text-ink" /> }}
            />
          </Text>
        }
      >
        <Button
          size="large"
          label={t('common.openMailApp')}
          onPress={() => void openMailApp()}
          testID="open-mail"
        />
      </MessageScreen>
    );
  }

  const error = request.error instanceof ApiError ? request.error : null;
  const formError = error && ['invalid_password', 'validation_failed'].includes(error.code);

  return (
    <FormScreen testID="change-email-screen">
      <Header title={t('changeEmail.title')} onBack={back} intro={t('changeEmail.intro')} />
      {error?.code === 'rate_limited' ? (
        <Notification
          level="error"
          title={t('rateLimited.title')}
          caption={t('rateLimited.wait')}
          testID="rate-limited"
        />
      ) : error && !formError ? (
        <UnreachableNotification onRetry={submit} retrying={request.isPending} />
      ) : null}
      <View className="gap-lg">
        <TextField
          ref={emailRef}
          testID="new-email"
          label={t('changeEmail.newEmail')}
          kind="email"
          placeholder={t('signUp.emailPlaceholder')}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (errors.email) setErrors({ ...errors, email: undefined });
          }}
          error={errors.email}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <TextField
          ref={passwordRef}
          testID="password"
          label={t('changeEmail.password')}
          kind="password"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (errors.password) setErrors({ ...errors, password: undefined });
          }}
          error={errors.password}
          returnKeyType="send"
          onSubmitEditing={submit}
        />
      </View>
      <Button
        size="large"
        label={t('changeEmail.submit')}
        loading={request.isPending}
        onPress={submit}
        testID="submit"
      />
    </FormScreen>
  );
}
