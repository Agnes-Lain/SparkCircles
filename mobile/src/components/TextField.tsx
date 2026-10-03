import { CircleAlert, Eye, EyeOff } from 'lucide-react-native';
import { type Ref, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, type TextInputProps, View } from 'react-native';

import { MIN_TOUCH_TARGET } from '../theme/a11y';
import { colorValue } from '../theme/colors';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

export type TextFieldKind =
  'text' | 'name' | 'givenName' | 'familyName' | 'email' | 'password' | 'newPassword';

export type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  kind?: TextFieldKind;
  placeholder?: string;
  /** Caption under the field (Ink 3). Replaced by the error when there is one. */
  helper?: string;
  /** Error text (Caption error-dark with an alert-circle icon), e.g. "Add your first name." */
  error?: string | null;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  ref?: Ref<TextInput>;
  testID?: string;
};

// Keyboard, autofill and autocorrect settings per kind of field.
const KIND: Record<TextFieldKind, Partial<TextInputProps>> = {
  text: {},
  name: { autoCapitalize: 'words', autoCorrect: false },
  givenName: {
    autoCapitalize: 'words',
    autoCorrect: false,
    autoComplete: 'given-name',
    textContentType: 'givenName',
  },
  familyName: {
    autoCapitalize: 'words',
    autoCorrect: false,
    autoComplete: 'family-name',
    textContentType: 'familyName',
  },
  email: {
    autoCapitalize: 'none',
    autoCorrect: false,
    autoComplete: 'email',
    keyboardType: 'email-address',
    textContentType: 'emailAddress',
  },
  password: {
    autoCapitalize: 'none',
    autoCorrect: false,
    autoComplete: 'current-password',
    textContentType: 'password',
  },
  newPassword: {
    autoCapitalize: 'none',
    autoCorrect: false,
    autoComplete: 'new-password',
    textContentType: 'newPassword',
  },
};

/**
 * Text input with its visible label, helper and error (design system section 8). Errors
 * say what to do and are part of the field's accessibility label, so screen readers read
 * them every time they reach the field, even with hints turned off (QA BUG-A05); the
 * screen moves focus to the first field in error and announces it. Password fields have an
 * eye toggle.
 */
export function TextField({
  label,
  value,
  onChangeText,
  kind = 'text',
  placeholder,
  helper,
  error,
  returnKeyType,
  onSubmitEditing,
  ref,
  testID,
}: TextFieldProps) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const isPassword = kind === 'password' || kind === 'newPassword';
  const [hidden, setHidden] = useState(true);
  const border = error ? 'border-error-dark' : focused ? 'border-green-dark' : 'border-ink-3';

  return (
    <View className="gap-xs">
      <Text className="text-body text-ink-2">{label}</Text>
      <View
        testID={testID ? `${testID}-box` : undefined}
        className={`flex-row items-center rounded-md border-[1.5px] bg-surface ${border}`}
        style={{ minHeight: MIN_TOUCH_TARGET }}
      >
        <TextInput
          ref={ref}
          testID={testID}
          accessibilityLabel={error ? `${label}. ${error}` : label}
          accessibilityHint={error ? undefined : helper}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colorValue('ink-3')}
          secureTextEntry={isPassword && hidden}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          submitBehavior={onSubmitEditing ? 'submit' : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 px-3.5 py-2.5 text-body text-ink"
          {...KIND[kind]}
        />
        {isPassword ? (
          <View className="mr-0.5">
            <IconButton
              icon={hidden ? Eye : EyeOff}
              color="ink-2"
              accessibilityLabel={hidden ? t('common.showPassword') : t('common.hidePassword')}
              onPress={() => setHidden((h) => !h)}
            />
          </View>
        ) : null}
      </View>
      {error ? (
        <View
          className="flex-row items-center gap-xs"
          testID={testID ? `${testID}-error` : undefined}
        >
          <Icon icon={CircleAlert} size={14} color="error-dark" />
          <Text className="flex-1 text-caption text-error-dark">{error}</Text>
        </View>
      ) : helper ? (
        <Text className="text-caption text-ink-3">{helper}</Text>
      ) : null}
    </View>
  );
}
