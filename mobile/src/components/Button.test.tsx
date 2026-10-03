import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '../test/render';
import { Button } from './Button';

describe('Button (design system section 5)', () => {
  it('is a 44 px button with its label', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Log in" onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Log in' });
    expect(button).toHaveStyle({ minHeight: 44 });
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is announced as disabled and ignores presses when disabled', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Send" onPress={onPress} disabled />);

    const button = screen.getByRole('button', { name: 'Send' });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows a busy state while loading and ignores presses', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Send" onPress={onPress} loading />);

    const button = screen.getByRole('button', { name: 'Send' });
    expect(button).toBeBusy();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
