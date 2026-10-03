import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, type TextInput, View } from 'react-native';

import { auth } from '../../api';
import { ApiError } from '../../api/errors';
import { deviceName } from '../../auth/deviceName';
import { ME_KEY } from '../../auth/useMe';
import { useSession } from '../../auth/useSession';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { Notification } from '../../components/Notification';
import { TextField } from '../../components/TextField';
import { TextLink } from '../../components/TextLink';
import { type FieldErrors, looksLikeEmail, useFocusFirstError } from './formErrors';
import { FormScreen } from './layouts';
import { UnreachableNotification } from './UnreachableNotification';
import { useSubmitOnce } from './useSubmitOnce';
import { useBack } from './useBack';

type Field = 'email';

/**
 * S5 Log in (AC-3.1, 3.2, 3.3). Wrong email and wrong password get the same message
 * (AC-3.2). After login the auth gate opens the screen the account needs: the tabs, or
 * Check your inbox / Terms updated / Closure in progress.
 */
export function LogInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const back = useBack('/welcome');
  const queryClient = useQueryClient();
  const { signIn } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const focusFirstError = useFocusFirstError(['email'] as const, { email: emailRef });

  const logIn = useMutation({
    mutationFn: () => auth().logIn(email.trim(), password, deviceName()),
    onSuccess: async ({ token, user }) => {
      queryClient.setQueryData(ME_KEY, user);
      await signIn(token);
    },
  });
  const sendLogIn = useSubmitOnce(logIn);

  const submit = () => {
    const next: FieldErrors<Field> = looksLikeEmail(email) ? {} : { email: t('fieldErrors.email') };
    setErrors(next);
    if (next.email) return focusFirstError(next);
    sendLogIn();
  };

  // An empty password is refused by the API as bad_request: same message as a wrong one.
  const error = logIn.error instanceof ApiError ? logIn.error : null;

  return (
    <FormScreen testID="log-in-screen">
      <Header title={t('logIn.title')} onBack={back} />

      {error?.code === 'invalid_credentials' || error?.code === 'bad_request' ? (
        <Notification
          level="error"
          title={t('logIn.wrongTitle')}
          caption={t('logIn.wrongCaption')}
        />
      ) : error?.code === 'account_locked' ? (
        <Notification
          level="error"
          title={t('logIn.lockedTitle')}
          caption={t('logIn.lockedCaption')}
          action={
            <Button
              size="small"
              variant="secondary"
              label={t('logIn.resetAction')}
              onPress={() => router.push('/forgot-password')}
            />
          }
        />
      ) : error?.code === 'rate_limited' ? (
        <Notification level="error" title={error.message} />
      ) : error ? (
        <UnreachableNotification onRetry={submit} retrying={logIn.isPending} />
      ) : null}

      <View className="gap-lg">
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
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <View>
          <TextField
            ref={passwordRef}
            testID="password"
            label={t('logIn.password')}
            kind="password"
            value={password}
            onChangeText={setPassword}
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          <View className="items-start">
            <TextLink label={t('logIn.forgot')} onPress={() => router.push('/forgot-password')} />
          </View>
        </View>
      </View>

      <View className="gap-sm">
        <Button
          size="large"
          label={t('logIn.submit')}
          loading={logIn.isPending}
          onPress={submit}
          testID="submit"
        />
        <View className="flex-row flex-wrap items-center justify-center gap-x-xs">
          <Text className="text-body text-ink-2">{t('logIn.newHere')}</Text>
          <TextLink label={t('logIn.createAccount')} onPress={() => router.replace('/sign-up')} />
        </View>
      </View>
    </FormScreen>
  );
}
