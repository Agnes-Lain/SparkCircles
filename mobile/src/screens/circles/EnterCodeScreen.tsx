import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { TextField } from '../../components/TextField';
import { FormScreen } from '../auth/layouts';
import { useBack } from '../auth/useBack';

/** Letters and digits only, upper-case (the API ignores dashes, spaces and case too). */
export const cleanCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * C4a Enter a code (design 4a): one field, "Continuer" opens the preview, which resolves the
 * code and shows the single neutral message when it isn't valid (AC-3.5, AC-2.8).
 */
export function EnterCodeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const back = useBack('/community');
  const [code, setCode] = useState('');
  const ready = cleanCode(code).length === 8;

  return (
    <FormScreen testID="enter-code">
      <Header title={t('circles.code.title')} onBack={back} intro={t('circles.code.intro')} />
      <TextField
        kind="inviteCode"
        label={t('circles.code.label')}
        placeholder={t('circles.code.placeholder')}
        value={code}
        onChangeText={setCode}
        helper={t('circles.code.helper')}
        returnKeyType="go"
        onSubmitEditing={() => ready && router.push(`/circles/join?code=${cleanCode(code)}`)}
        testID="code-input"
      />
      <Button
        size="large"
        label={t('circles.code.continue')}
        disabled={!ready}
        onPress={() => router.push(`/circles/join?code=${cleanCode(code)}`)}
        testID="code-continue"
      />
      <Text className="text-caption text-ink-3">{t('circles.code.tooManyHint')}</Text>
    </FormScreen>
  );
}
