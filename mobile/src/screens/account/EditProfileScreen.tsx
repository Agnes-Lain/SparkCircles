import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, type TextInput, View } from 'react-native';

import { account } from '../../api';
import { PUBLIC_PROFILE_KEY } from '../../api/account';
import { ApiError } from '../../api/errors';
import type { Me, ProfileParams } from '../../api/types';
import { maskEmail } from '../../auth/pendingEmail';
import { ME_KEY, useMe } from '../../auth/useMe';
import { Avatar } from '../../components/Avatar';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { TextField } from '../../components/TextField';
import { TextLink } from '../../components/TextLink';
import { useToast } from '../../components/ToastProvider';
import { type FieldErrors, serverFieldErrors, useFocusFirstError } from '../auth/formErrors';
import { FormScreen } from '../auth/layouts';
import { UnreachableNotification } from '../auth/UnreachableNotification';
import { useBack } from '../auth/useBack';
import { useSubmitOnce } from '../auth/useSubmitOnce';

type Field = 'firstName' | 'lastName' | 'city';
const ORDER = ['firstName', 'lastName', 'city'] as const;
// The city has no designed error (it is optional and free text).
const API_FIELDS: Record<string, Field> = { first_name: 'firstName', last_name: 'lastName' };

/**
 * A3 Edit profile (AC-6.1, 7.8). A verified parent who changes a name is warned first: the
 * Verified badge is removed (the API resets the verification).
 */
export function EditProfileScreen() {
  const { t } = useTranslation();
  const me = useMe();
  if (!me.data) {
    return (
      <FormScreen testID="edit-profile-screen">
        <BackHeader />
        {me.isError ? (
          <UnreachableNotification onRetry={() => void me.refetch()} retrying={me.isFetching} />
        ) : null}
      </FormScreen>
    );
  }
  return <EditProfileForm me={me.data} key={me.data.id} title={t('editProfile.title')} />;
}

function BackHeader() {
  const { t } = useTranslation();
  const back = useBack('/account');
  return <Header title={t('editProfile.title')} onBack={back} />;
}

function EditProfileForm({ me, title }: { me: Me; title: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const back = useBack('/account');
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [firstName, setFirstName] = useState(me.first_name);
  const [lastName, setLastName] = useState(me.last_name);
  const [city, setCity] = useState(me.city_shown ?? '');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [nameSheet, setNameSheet] = useState(false);
  const saveRef = useRef<View>(null);
  const firstNameRef = useRef<TextInput>(null);
  const lastNameRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const refs = { firstName: firstNameRef, lastName: lastNameRef, city: cityRef };
  const focusFirstError = useFocusFirstError(ORDER, refs);

  const message = (field: Field) =>
    field === 'firstName' ? t('fieldErrors.firstName') : t('fieldErrors.lastName');

  const save = useMutation({
    mutationFn: (params: ProfileParams) => account().updateProfile(params),
    onSuccess: (updated) => {
      queryClient.setQueryData(ME_KEY, updated);
      void queryClient.invalidateQueries({ queryKey: PUBLIC_PROFILE_KEY });
      showToast(t('editProfile.saved'));
      back();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'validation_failed') {
        const next = serverFieldErrors(error.details, API_FIELDS, message);
        setErrors(next);
        focusFirstError(next);
      }
    },
  });
  const sendSave = useSubmitOnce(save);

  const params = (): ProfileParams => ({
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    city_shown: city.trim() || null,
  });

  const submit = () => {
    const next: FieldErrors<Field> = {};
    if (!firstName.trim()) next.firstName = t('fieldErrors.firstName');
    if (!lastName.trim()) next.lastName = t('fieldErrors.lastName');
    setErrors(next);
    if (Object.keys(next).length > 0) return focusFirstError(next);
    const nameChanged =
      firstName.trim() !== me.first_name.trim() || lastName.trim() !== me.last_name.trim();
    // AC-7.8: a verified parent confirms before losing the badge.
    if (nameChanged && me.verification.verified) return setNameSheet(true);
    sendSave(params());
  };

  const error = save.error instanceof ApiError ? save.error : null;
  const clear = (field: Field) => errors[field] && setErrors({ ...errors, [field]: undefined });

  return (
    <FormScreen testID="edit-profile-screen">
      <Header title={title} onBack={back} />
      <Avatar name={firstName || me.first_name} seed={me.id} />

      {error && error.code !== 'validation_failed' ? (
        <UnreachableNotification onRetry={submit} retrying={save.isPending} />
      ) : null}

      <View className="gap-lg">
        <TextField
          ref={firstNameRef}
          testID="first-name"
          label={t('signUp.firstName')}
          kind="givenName"
          value={firstName}
          onChangeText={(value) => {
            setFirstName(value);
            clear('firstName');
          }}
          error={errors.firstName}
          returnKeyType="next"
          onSubmitEditing={() => lastNameRef.current?.focus()}
        />
        <TextField
          ref={lastNameRef}
          testID="last-name"
          label={t('signUp.lastName')}
          kind="familyName"
          helper={t('signUp.lastNameHelper')}
          value={lastName}
          onChangeText={(value) => {
            setLastName(value);
            clear('lastName');
          }}
          error={errors.lastName}
          returnKeyType="next"
          onSubmitEditing={() => cityRef.current?.focus()}
        />
        <TextField
          ref={cityRef}
          testID="city"
          label={t('editProfile.city')}
          kind="name"
          helper={t('editProfile.cityHelper')}
          value={city}
          onChangeText={(value) => {
            setCity(value);
            clear('city');
          }}
          error={errors.city}
          returnKeyType="done"
          onSubmitEditing={submit}
        />

        <View className="gap-xs">
          <Text className="text-body text-ink-2">{t('editProfile.email')}</Text>
          <View className="flex-row items-center justify-between gap-md">
            <Text className="flex-1 text-body text-ink" testID="email">
              {maskEmail(me.email)}
            </Text>
            <Button
              variant="ghost"
              size="small"
              label={t('editProfile.change')}
              accessibilityHint={t('editProfile.changeA11y')}
              onPress={() => router.push('/account/change-email')}
              testID="change-email"
            />
          </View>
          {me.pending_email ? (
            <View className="items-start" testID="pending-email">
              <Text className="text-caption text-ink-3">
                {t('editProfile.pending', { email: maskEmail(me.pending_email) })}
              </Text>
              <TextLink
                small
                label={t('checkInbox.resend')}
                onPress={() => router.push('/account/change-email?resend=1')}
                testID="resend-email-change"
              />
            </View>
          ) : null}
        </View>
      </View>

      <Button
        ref={saveRef}
        size="large"
        label={t('editProfile.save')}
        loading={save.isPending}
        onPress={submit}
        testID="save"
      />

      <BottomSheet
        visible={nameSheet}
        onClose={() => setNameSheet(false)}
        returnFocusTo={saveRef}
        testID="name-sheet"
      >
        <View className="gap-xs">
          <Text accessibilityRole="header" className="text-h2 text-ink">
            {t('editProfile.nameSheetTitle')}
          </Text>
          <Text className="text-body text-ink-2">{t('editProfile.nameSheetBody')}</Text>
        </View>
        <View className="gap-sm">
          <Button
            size="large"
            label={t('editProfile.nameSheetConfirm')}
            onPress={() => {
              setNameSheet(false);
              sendSave(params());
            }}
            testID="confirm-name"
          />
          <Button
            size="large"
            variant="ghost"
            label={t('editProfile.nameSheetKeep')}
            onPress={() => {
              setNameSheet(false);
              setFirstName(me.first_name);
              setLastName(me.last_name);
            }}
            testID="keep-name"
          />
        </View>
      </BottomSheet>
    </FormScreen>
  );
}
