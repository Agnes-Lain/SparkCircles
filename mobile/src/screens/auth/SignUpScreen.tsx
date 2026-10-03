import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Text, type TextInput, View } from 'react-native';

import { auth } from '../../api';
import { LEGAL_KEY } from '../../api/auth';
import { ApiError } from '../../api/errors';
import type { Legal } from '../../api/types';
import { setPendingEmail } from '../../auth/pendingEmail';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { Header } from '../../components/Header';
import { Notification } from '../../components/Notification';
import { TextField } from '../../components/TextField';
import { TextLink } from '../../components/TextLink';
import { useToast } from '../../components/ToastProvider';
import { currentLocale } from '../../i18n';
import { openLegalDocument } from './external';
import {
  type FieldErrors,
  looksLikeEmail,
  MIN_PASSWORD_LENGTH,
  serverFieldErrors,
  useFocusFirstError,
} from './formErrors';
import { FormScreen } from './layouts';
import { UnreachableNotification } from './UnreachableNotification';
import { useBack } from './useBack';

type Field = 'firstName' | 'lastName' | 'email' | 'password' | 'adult' | 'terms';
const ORDER: readonly Field[] = ['firstName', 'lastName', 'email', 'password', 'adult', 'terms'];
const API_FIELDS: Record<string, Field> = {
  first_name: 'firstName',
  last_name: 'lastName',
  email: 'email',
  password: 'password',
  adult_confirmed: 'adult',
  terms_accepted: 'terms',
};

/**
 * S2 Sign up (AC-1.1, 1.2, 1.4, 1.6, 5.1, 5.3): only the 6 inputs of AC-1.6, the two
 * required boxes and the optional marketing box, all unticked by default.
 */
export function SignUpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const back = useBack('/welcome');
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<Field>>({});

  const firstNameRef = useRef<TextInput>(null);
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const adultRef = useRef<View>(null);
  const termsRef = useRef<View>(null);
  const focusFirstError = useFocusFirstError(ORDER, {
    firstName: firstNameRef,
    lastName: lastNameRef,
    email: emailRef,
    password: passwordRef,
    adult: adultRef,
    terms: termsRef,
  });

  const message = useMemo(
    () =>
      ({
        firstName: t('fieldErrors.firstName'),
        lastName: t('fieldErrors.lastName'),
        email: t('fieldErrors.email'),
        password: t('fieldErrors.password'),
        adult: t('fieldErrors.adult'),
        terms: t('fieldErrors.terms'),
      }) satisfies Record<Field, string>,
    [t],
  );

  const register = useMutation({
    mutationFn: () =>
      auth().register({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password,
        adult_confirmed: adult,
        terms_accepted: terms,
        marketing_opt_in: marketing,
        locale: currentLocale(),
      }),
    onSuccess: () => {
      // AC-1.3: the same "Check your inbox" whether the address is new or already used.
      setPendingEmail(email.trim());
      router.replace('/check-inbox');
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'validation_failed') {
        const next = serverFieldErrors(error.details, API_FIELDS, (field) => message[field]);
        setErrors(next);
        focusFirstError(next);
      }
    },
  });

  const validate = (): FieldErrors<Field> => {
    const next: FieldErrors<Field> = {};
    if (!firstName.trim()) next.firstName = message.firstName;
    if (!lastName.trim()) next.lastName = message.lastName;
    if (!looksLikeEmail(email)) next.email = message.email;
    if (password.length < MIN_PASSWORD_LENGTH) next.password = message.password;
    if (!adult) next.adult = message.adult;
    if (!terms) next.terms = message.terms;
    return next;
  };

  const submit = () => {
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusFirstError(next);
      return;
    }
    register.mutate();
  };

  // Clears a field's error as soon as the person fixes it.
  const update =
    <T,>(setter: (value: T) => void, field: Field) =>
    (value: T) => {
      setter(value);
      if (!errors[field]) return;
      setErrors((previous) => {
        const next = { ...previous };
        delete next[field];
        return next;
      });
    };

  const openLegal = async (which: keyof Pick<Legal, 'terms' | 'privacy'>) => {
    try {
      const legal = await queryClient.fetchQuery({
        queryKey: LEGAL_KEY,
        queryFn: () => auth().legal(),
        staleTime: 5 * 60_000,
      });
      await openLegalDocument(legal[which].url);
    } catch {
      showToast(t('errors.unreachable.title'), 'error');
    }
  };

  const error = register.error instanceof ApiError ? register.error : null;
  const termsLinks = [
    { label: t('signUp.termsLink'), onPress: () => void openLegal('terms') },
    { label: t('signUp.privacyLink'), onPress: () => void openLegal('privacy') },
  ];

  return (
    <FormScreen testID="sign-up-screen">
      <Header title={t('signUp.title')} onBack={back} intro={t('signUp.intro')} />

      {error && error.code === 'rate_limited' ? (
        <Notification level="error" title={error.message} />
      ) : error && error.code !== 'validation_failed' ? (
        <UnreachableNotification onRetry={submit} retrying={register.isPending} />
      ) : null}

      <View className="gap-lg">
        <TextField
          ref={firstNameRef}
          testID="first-name"
          label={t('signUp.firstName')}
          kind="givenName"
          value={firstName}
          onChangeText={update(setFirstName, 'firstName')}
          error={errors.firstName}
          returnKeyType="next"
          onSubmitEditing={() => lastNameRef.current?.focus()}
        />
        <TextField
          ref={lastNameRef}
          testID="last-name"
          label={t('signUp.lastName')}
          kind="familyName"
          placeholder={t('signUp.lastNamePlaceholder')}
          helper={t('signUp.lastNameHelper')}
          value={lastName}
          onChangeText={update(setLastName, 'lastName')}
          error={errors.lastName}
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <TextField
          ref={emailRef}
          testID="email"
          label={t('signUp.email')}
          kind="email"
          placeholder={t('signUp.emailPlaceholder')}
          value={email}
          onChangeText={update(setEmail, 'email')}
          error={errors.email}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <TextField
          ref={passwordRef}
          testID="password"
          label={t('signUp.password')}
          kind="newPassword"
          placeholder={t('signUp.passwordPlaceholder')}
          helper={t('signUp.passwordHelper')}
          value={password}
          onChangeText={update(setPassword, 'password')}
          error={errors.password}
          returnKeyType="done"
        />

        <View>
          <View ref={adultRef}>
            <Checkbox
              testID="adult"
              accessibilityLabel={t('signUp.adult')}
              label={t('signUp.adult')}
              checked={adult}
              onChange={update(setAdult, 'adult')}
              error={errors.adult}
            />
          </View>
          <View ref={termsRef}>
            <Checkbox
              testID="terms"
              accessibilityLabel={t('signUp.termsPlain')}
              links={termsLinks}
              label={
                <Text className="text-body text-ink">
                  <Trans
                    i18nKey="signUp.terms"
                    components={{
                      terms: (
                        <Text
                          accessibilityRole="link"
                          className="font-medium text-green-dark"
                          onPress={termsLinks[0]?.onPress}
                        />
                      ),
                      privacy: (
                        <Text
                          accessibilityRole="link"
                          className="font-medium text-green-dark"
                          onPress={termsLinks[1]?.onPress}
                        />
                      ),
                    }}
                  />
                </Text>
              }
              checked={terms}
              onChange={update(setTerms, 'terms')}
              error={errors.terms}
            />
          </View>
          <Checkbox
            testID="marketing"
            accessibilityLabel={`${t('signUp.marketing')} ${t('signUp.optional')}`}
            label={
              <Text className="text-body text-ink">
                {t('signUp.marketing')} <Text className="text-ink-3">{t('signUp.optional')}</Text>
              </Text>
            }
            checked={marketing}
            onChange={setMarketing}
          />
        </View>
      </View>

      <View className="gap-sm">
        <Button
          size="large"
          label={t('signUp.submit')}
          loading={register.isPending}
          onPress={submit}
          testID="submit"
        />
        <View className="flex-row flex-wrap items-center justify-center gap-x-xs">
          <Text className="text-body text-ink-2">{t('signUp.haveAccount')}</Text>
          <TextLink label={t('signUp.logIn')} onPress={() => router.replace('/log-in')} />
        </View>
      </View>
    </FormScreen>
  );
}
