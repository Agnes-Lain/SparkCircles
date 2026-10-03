import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, Platform, Text } from 'react-native';

import i18n from '../i18n';
import { MIN_TOUCH_TARGET } from '../theme/a11y';
import { renderWithProviders } from '../test/render';
import { Checkbox } from './Checkbox';
import { Header } from './Header';
import { SuccessCheckmark } from './SuccessCheckmark';
import { TextField } from './TextField';
import { TextLink } from './TextLink';
import { TOAST_DURATION_MS, useToast } from './ToastProvider';

describe('TextField (design system section 8)', () => {
  beforeEach(() => i18n.changeLanguage('fr'));

  it('always shows its label above the field and gives it to screen readers', async () => {
    await renderWithProviders(
      <TextField label="E-mail" value="" onChangeText={jest.fn()} helper="Aide" />,
    );

    expect(screen.getByText('E-mail')).toBeOnTheScreen();
    expect(screen.getByLabelText('E-mail')).toHaveProp('accessibilityHint', 'Aide');
    expect(screen.getByText('Aide')).toBeOnTheScreen();
  });

  it("AC-1.2 replaces the helper with the error, read with the field's label (QA BUG-A05)", async () => {
    await renderWithProviders(
      <TextField
        label="Prénom"
        value=""
        onChangeText={jest.fn()}
        helper="Aide"
        error="Ajoute ton prénom."
        testID="first"
      />,
    );

    expect(screen.queryByText('Aide')).toBeNull();
    expect(screen.getByText('Ajoute ton prénom.')).toBeOnTheScreen();
    // Part of the label, so VoiceOver reads it even with hints turned off.
    expect(screen.getByLabelText('Prénom. Ajoute ton prénom.')).not.toHaveProp('accessibilityHint');
    expect(screen.getByTestId('first-box').props.className).toContain('border-error-dark');
  });

  it('is at least 44 px tall', async () => {
    await renderWithProviders(
      <TextField label="E-mail" value="" onChangeText={jest.fn()} testID="email" />,
    );
    expect(screen.getByTestId('email-box')).toHaveStyle({ minHeight: MIN_TOUCH_TARGET });
  });
});

describe('Checkbox (design system section 8)', () => {
  it('is a full-width checkbox row, unticked until pressed', async () => {
    const onChange = jest.fn();
    await renderWithProviders(
      <Checkbox
        accessibilityLabel="J'ai 18 ans ou plus"
        label="J'ai 18 ans ou plus"
        checked={false}
        onChange={onChange}
      />,
    );

    const box = screen.getByRole('checkbox', { name: "J'ai 18 ans ou plus" });
    expect(box).not.toBeChecked();
    expect(box).toHaveStyle({ minHeight: MIN_TOUCH_TARGET });
    await fireEvent.press(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('offers its inline links to screen readers as actions', async () => {
    const openTerms = jest.fn();
    await renderWithProviders(
      <Checkbox
        accessibilityLabel="J'accepte les conditions"
        label={<Text>J&apos;accepte les conditions</Text>}
        checked={false}
        onChange={jest.fn()}
        links={[{ label: "conditions d'utilisation", onPress: openTerms }]}
      />,
    );

    const box = screen.getByRole('checkbox');
    expect(box.props.accessibilityActions).toContainEqual({
      name: "conditions d'utilisation",
      label: "conditions d'utilisation",
    });
    await fireEvent(box, 'accessibilityAction', {
      nativeEvent: { actionName: "conditions d'utilisation" },
    });
    expect(openTerms).toHaveBeenCalled();
  });

  it('shows its error under the row and in its accessibility label (QA BUG-A05)', async () => {
    await renderWithProviders(
      <Checkbox
        accessibilityLabel="J'ai 18 ans ou plus"
        label="J'ai 18 ans ou plus"
        checked={false}
        onChange={jest.fn()}
        error="Coche cette case."
      />,
    );

    expect(screen.getByText('Coche cette case.')).toBeOnTheScreen();
    expect(
      screen.getByRole('checkbox', { name: "J'ai 18 ans ou plus. Coche cette case." }),
    ).toBeOnTheScreen();
  });
});

describe('TextLink (design system section 5)', () => {
  it('BUG-A02 gives even a short Caption link a 44×44 target', async () => {
    await renderWithProviders(<TextLink small label="English" onPress={jest.fn()} />);
    expect(screen.getByRole('link', { name: 'English' })).toHaveStyle({
      minHeight: MIN_TOUCH_TARGET,
      minWidth: MIN_TOUCH_TARGET,
    });
  });
});

describe('Header (design system section 10)', () => {
  it('has a 44 px "Back" button and the title as a header', async () => {
    const onBack = jest.fn();
    await renderWithProviders(<Header title="Connexion" onBack={onBack} />);

    const back = screen.getByRole('button', { name: 'Retour' });
    expect(back).toHaveStyle({ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET });
    await fireEvent.press(back);
    expect(onBack).toHaveBeenCalled();
    expect(screen.getByRole('header', { name: 'Connexion' })).toBeOnTheScreen();
  });
});

function ToastButton({ message }: { message: string }) {
  const { showToast } = useToast();
  return (
    <Text accessibilityRole="button" onPress={() => showToast(message)}>
      show
    </Text>
  );
}

describe('Toast (design system section 9)', () => {
  afterEach(() => jest.useRealTimers());

  it('shows for 3 s and is announced to VoiceOver', async () => {
    jest.useFakeTimers();
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await renderWithProviders(<ToastButton message="Mot de passe modifié" />);

    await fireEvent.press(screen.getByRole('button', { name: 'show' }));

    expect(screen.getByText('Mot de passe modifié')).toBeOnTheScreen();
    expect(screen.getByTestId('toast')).toHaveProp('accessibilityLiveRegion', 'polite');
    if (Platform.OS === 'ios') expect(announce).toHaveBeenCalledWith('Mot de passe modifié');

    await act(() => jest.advanceTimersByTime(TOAST_DURATION_MS));
    expect(screen.queryByText('Mot de passe modifié')).toBeNull();
  });
});

describe('SuccessCheckmark (design system section 13)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is drawn at once, without animation, under reduced motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await renderWithProviders(<SuccessCheckmark />);

    const mark = await screen.findByTestId('success-checkmark', { includeHiddenElements: true });
    expect(mark).toHaveProp('importantForAccessibility', 'no-hide-descendants');
  });
});

describe('SuccessCheckmark motion', () => {
  afterEach(() => jest.restoreAllMocks());

  it('draws the check in 300 ms when motion is allowed', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const timing = jest
      .spyOn(Animated, 'timing')
      .mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
    await renderWithProviders(<SuccessCheckmark />);

    await screen.findByTestId('success-checkmark', { includeHiddenElements: true });
    await act(async () => undefined);
    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ duration: 300 }),
    );
  });

  it('never animates under reduced motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    await renderWithProviders(<SuccessCheckmark />);

    await screen.findByTestId('success-checkmark', { includeHiddenElements: true });
    await act(async () => undefined);
    expect(timing).not.toHaveBeenCalled();
  });
});
