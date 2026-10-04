import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, type TextInput, View } from 'react-native';

import { account } from '../../api';
import { ApiError } from '../../api/errors';
import { ME_KEY } from '../../auth/useMe';
import { useSession } from '../../auth/useSession';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { type FieldErrors, MIN_PASSWORD_LENGTH, useFocusFirstError } from '../auth/formErrors';
import { FormScreen } from '../auth/layouts';
import { UnreachableNotification } from '../auth/UnreachableNotification';
import { useBack } from '../auth/useBack';
import { useSubmitOnce } from '../auth/useSubmitOnce';

type Field = 'current' | 'password';
const ORDER = ['current', 'password'] as const;

/**
 * A5 Password and devices (AC-3.6, 4.4): change the password (other devices are logged
 * out), or log out of every device after a confirmation sheet.
 */
export function SecurityScreen() {
  const { t } = useTranslation();
  const back = useBack('/account');
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { signOut } = useSession();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const logOutAllRef = useRef<View>(null);
  const currentRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const refs = { current: currentRef, password: passwordRef };
  const focusFirstError = useFocusFirstError(ORDER, refs);

  const change = useMutation({
    mutationFn: (vars: { current: string; password: string }) =>
      account().changePassword(vars.current, vars.password),
    onSuccess: (me) => {
      queryClient.setQueryData(ME_KEY, me);
      setCurrent('');
      setPassword('');
      showToast(t('newPassword.changed'));
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) return;
      const next: FieldErrors<Field> =
        error.code === 'invalid_password'
          ? { current: t('security.wrongCurrent') }
          : error.code === 'validation_failed'
            ? { password: t('fieldErrors.password') }
            : {};
      if (Object.keys(next).length === 0) return;
      setErrors(next);
      focusFirstError(next);
    },
  });
  const sendChange = useSubmitOnce(change);

  const everywhere = useMutation({
    mutationFn: () => account().logOutEverywhere(),
    onSuccess: async () => {
      setSheetOpen(false);
      await signOut();
      showToast(t('common.loggedOut'));
    },
  });

  const submit = () => {
    const next: FieldErrors<Field> = {};
    if (!current) next.current = t('fieldErrors.passwordRequired');
    if (password.length < MIN_PASSWORD_LENGTH) next.password = t('fieldErrors.password');
    setErrors(next);
    if (Object.keys(next).length > 0) return focusFirstError(next);
    sendChange({ current, password });
  };

  const error = change.error instanceof ApiError ? change.error : null;
  const formError = error && ['invalid_password', 'validation_failed'].includes(error.code);

  return (
    <FormScreen testID="security-screen">
      <Header title={t('security.title')} onBack={back} />
      {error && !formError ? (
        <UnreachableNotification onRetry={submit} retrying={change.isPending} />
      ) : null}
      <View className="gap-lg">
        <TextField
          ref={currentRef}
          testID="current-password"
          label={t('security.current')}
          kind="password"
          value={current}
          onChangeText={(value) => {
            setCurrent(value);
            if (errors.current) setErrors({ ...errors, current: undefined });
          }}
          error={errors.current}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <TextField
          ref={passwordRef}
          testID="new-password"
          label={t('newPassword.label')}
          kind="newPassword"
          helper={t('signUp.passwordHelper')}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (errors.password) setErrors({ ...errors, password: undefined });
          }}
          error={errors.password}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      </View>
      <View className="gap-sm">
        <Button
          size="large"
          label={t('security.submit')}
          loading={change.isPending}
          onPress={submit}
          testID="submit"
        />
        <Text className="text-center text-caption text-ink-3">{t('newPassword.caption')}</Text>
      </View>
      <View className="items-center">
        <Button
          ref={logOutAllRef}
          variant="ghost"
          label={t('security.logOutAll')}
          onPress={() => setSheetOpen(true)}
          testID="log-out-all"
        />
      </View>

      <BottomSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        returnFocusTo={logOutAllRef}
        testID="log-out-all-sheet"
      >
        <View className="gap-xs">
          <Text accessibilityRole="header" className="text-h2 text-ink">
            {t('security.sheetTitle')}
          </Text>
          <Text className="text-body text-ink-2">{t('security.sheetBody')}</Text>
        </View>
        {everywhere.isError ? (
          <UnreachableNotification
            onRetry={() => everywhere.mutate()}
            retrying={everywhere.isPending}
          />
        ) : null}
        <View className="gap-sm">
          <Button
            size="large"
            label={t('security.sheetConfirm')}
            loading={everywhere.isPending}
            onPress={() => everywhere.mutate()}
            testID="confirm-log-out-all"
          />
          <Button
            size="large"
            variant="ghost"
            label={t('common.cancel')}
            onPress={() => setSheetOpen(false)}
          />
        </View>
      </BottomSheet>
    </FormScreen>
  );
}
