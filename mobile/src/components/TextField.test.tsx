import { fireEvent, screen } from '@testing-library/react-native';
import { Keyboard, Platform } from 'react-native';

import i18n from '../i18n';
import { renderWithProviders } from '../test/render';
import { TextField, type TextFieldKind } from './TextField';

function renderField(kind: TextFieldKind) {
  return renderWithProviders(
    <TextField label="Téléphone" value="" onChangeText={() => {}} kind={kind} testID="field" />,
  );
}

describe('TextField keypad "Done" bar', () => {
  beforeEach(() => i18n.changeLanguage('fr'));
  afterEach(() => jest.restoreAllMocks());

  it.each<TextFieldKind>(['emergencyPhone', 'phone', 'number'])(
    'gives a %s field a labelled Done button on iOS that hides the keypad',
    async (kind) => {
      const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation();
      await renderField(kind);

      const done = screen.getByRole('button', { name: 'Masquer le clavier' });
      expect(done).toHaveTextContent('OK');
      expect(screen.getByTestId('field').props.inputAccessoryViewID).toEqual(expect.any(String));

      await fireEvent.press(done);
      expect(dismiss).toHaveBeenCalled();
    },
  );

  it('leaves fields with a Return key alone', async () => {
    await renderField('email');
    expect(screen.queryByTestId('field-done')).toBeNull();
    expect(screen.getByTestId('field').props.inputAccessoryViewID).toBeUndefined();
  });

  it('has no Done bar on Android (the back gesture hides the keypad)', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await renderField('emergencyPhone');
    expect(screen.queryByTestId('field-done')).toBeNull();
  });
});
