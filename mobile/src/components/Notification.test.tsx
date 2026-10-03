import { screen } from '@testing-library/react-native';
import { AccessibilityInfo, Platform, Text } from 'react-native';

import { renderWithProviders } from '../test/render';
import { Notification } from './Notification';

describe('Notification (design system section 9)', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  it('Error: alert read as one element, with an Android live region', async () => {
    await renderWithProviders(
      <Notification
        level="error"
        title="Impossible de joindre SparkCircles"
        caption="Vérifie ta connexion et réessaie."
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(
      'Impossible de joindre SparkCirclesVérifie ta connexion et réessaie.',
    );
    expect(alert).toHaveProp('accessibilityLiveRegion', 'polite');
  });

  it('QA BUG-01 Error: VoiceOver announces the title and caption when it appears', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

    await renderWithProviders(
      <Notification
        level="error"
        title="Impossible de joindre SparkCircles"
        caption="Vérifie ta connexion et réessaie."
      />,
    );

    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(
      'Impossible de joindre SparkCircles. Vérifie ta connexion et réessaie.',
    );
  });

  it('Error: announces again when the message changes, not on every render', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { rerender } = await renderWithProviders(<Notification level="error" title="A" />);
    await rerender(<Notification level="error" title="A" />);
    await rerender(<Notification level="error" title="B" />);

    expect(announce.mock.calls).toEqual([['A'], ['B']]);
  });

  it('Error on Android: relies on the live region only (no double reading)', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
    try {
      await renderWithProviders(<Notification level="error" title="A" />);
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, get: () => original });
    }
    expect(announce).not.toHaveBeenCalled();
  });

  it('other levels are not alerts and are not announced', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await renderWithProviders(
      <Notification level="confirmed" title="Échange confirmé" testID="n" />,
    );

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Échange confirmé')).toBeOnTheScreen();
    expect(announce).not.toHaveBeenCalled();
  });

  it('keeps the action as a separate control', async () => {
    await renderWithProviders(
      <Notification
        level="error"
        title="A"
        action={<Text accessibilityRole="button">Réessayer</Text>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeOnTheScreen();
    expect(screen.getByRole('alert')).not.toHaveTextContent(/Réessayer/);
  });
});
