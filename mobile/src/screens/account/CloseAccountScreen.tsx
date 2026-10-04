import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Calendar, Clock, EyeOff, LogOut, type LucideIcon } from 'lucide-react-native';
import { Fragment, type ReactNode, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { AccessibilityInfo, Text, type TextInput, View } from 'react-native';

import { account } from '../../api';
import { ApiError } from '../../api/errors';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { IconSquare } from '../../components/IconSquare';
import { TextField } from '../../components/TextField';
import { FormScreen } from '../auth/layouts';
import { UnreachableNotification } from '../auth/UnreachableNotification';
import { useBack } from '../auth/useBack';
import { useSubmitOnce } from '../auth/useSubmitOnce';

/**
 * Days between closing and erasure (AC-11.1, contract §7). A7 says "in 30 days" rather than a
 * date computed on the phone; A8 shows the server's `erasure_on` (M-6).
 */
export const CLOSURE_GRACE_DAYS = 30;

/**
 * A7 Close my account (AC-11.1, 11.9). Reached from My account and from S9 "I don't
 * accept". Destructive Large button, disabled until a password is typed. On success every
 * device is logged out (the token no longer works) and A8 explains what happens next.
 */
export function CloseAccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const back = useBack('/account');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const close = useMutation({
    mutationFn: (value: string) => account().closeAccount(value),
    onSuccess: ({ closure }) =>
      router.replace(`/account-closed?date=${encodeURIComponent(closure.erasure_on)}`),
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'invalid_password') {
        const message = t('fieldErrors.passwordMismatch');
        setError(message);
        passwordRef.current?.focus();
        AccessibilityInfo.announceForAccessibility(message);
      }
    },
  });
  const sendClose = useSubmitOnce(close);

  const apiError = close.error instanceof ApiError ? close.error : null;
  const submit = () => {
    if (password) sendClose(password);
  };

  return (
    <FormScreen testID="close-account-screen">
      <Header title={t('closeAccount.title')} onBack={back} intro={t('closeAccount.intro')} />

      <View className="gap-md rounded-lg border-[0.5px] border-border-soft bg-surface p-lg">
        {(
          [
            [EyeOff, t('closeAccount.hidden')],
            [LogOut, t('closeAccount.loggedOut')],
            [
              Calendar,
              <Trans
                key="erased"
                i18nKey="closeAccount.erased"
                values={{ days: CLOSURE_GRACE_DAYS }}
                components={{ b: <Text className="font-medium" /> }}
              />,
            ],
            [Clock, t('closeAccount.recover')],
          ] as [LucideIcon, ReactNode][]
        ).map(([icon, text], index) => (
          <Fragment key={index}>
            {index > 0 ? <View className="h-[0.5px] bg-border-soft" /> : null}
            <View className="flex-row items-start gap-md">
              <IconSquare icon={icon} />
              <Text className="flex-1 text-body text-ink">{text}</Text>
            </View>
          </Fragment>
        ))}
      </View>

      {apiError && apiError.code !== 'invalid_password' ? (
        <UnreachableNotification onRetry={submit} retrying={close.isPending} />
      ) : null}

      <TextField
        ref={passwordRef}
        testID="password"
        label={t('closeAccount.password')}
        placeholder={t('closeAccount.placeholder')}
        kind="password"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          if (error) setError(null);
        }}
        error={error}
        returnKeyType="done"
        onSubmitEditing={submit}
      />

      <View className="gap-md">
        <Button
          size="large"
          variant="destructive"
          icon={LogOut}
          label={t('closeAccount.submit')}
          disabled={!password}
          loading={close.isPending}
          accessibilityHint={password ? undefined : t('closeAccount.needPassword')}
          onPress={submit}
          testID="close"
        />
        {!password ? (
          <Text className="-mt-xs text-center text-caption text-ink-3">
            {t('closeAccount.needPassword')}
          </Text>
        ) : null}
        <Button
          size="large"
          variant="ghost"
          label={t('closure.keep')}
          onPress={back}
          testID="keep"
        />
      </View>
    </FormScreen>
  );
}
