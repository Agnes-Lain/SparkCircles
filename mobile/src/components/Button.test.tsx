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

  it('Module CTA: module Base fill with Ink text (section 5)', async () => {
    await renderWithProviders(
      <Button
        label="Créer ma communauté"
        variant="module"
        module="community"
        onPress={jest.fn()}
      />,
    );
    const button = screen.getByRole('button', { name: 'Créer ma communauté' });
    expect(button.props.className).toContain('bg-sky');
    expect(screen.getByText('Créer ma communauté').props.className).toContain('text-ink');
  });

  it('Secondary: mint Light fill, mint Dark label and 1.5 px mint Dark border (v1.6)', async () => {
    await renderWithProviders(<Button label="Plus tard" variant="secondary" onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: 'Plus tard' });
    expect(button.props.className).toContain('bg-green-light');
    expect(button.props.className).toContain('border-[1.5px] border-green-dark');
    expect(screen.getByText('Plus tard').props.className).toContain('text-green-dark');
  });

  it('QA BUG-09 Primary keeps its size when pressed: the reserved border only changes color', async () => {
    await renderWithProviders(<Button label="Log in" onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: 'Log in' });
    expect(button.props.className).toContain('border-[1.5px] border-transparent');

    await fireEvent(button, 'pressIn');

    const pressed = screen.getByRole('button', { name: 'Log in' });
    expect(pressed.props.className).toContain('border-[1.5px] border-green-dark');
    expect(pressed.props.className).not.toContain('border-transparent');
    expect(pressed).toHaveStyle({ transform: [{ scale: 0.97 }] });
  });
});
