import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import i18n from '../i18n';
import { TestProviders } from './render';
import TabsLayout from '../app/(tabs)/_layout';
import CommunityScreen from '../app/(tabs)/community';
import EventsScreen from '../app/(tabs)/events';
import HomeScreen from '../app/(tabs)/index';
import MarketScreen from '../app/(tabs)/market';
import TravelScreen from '../app/(tabs)/travel';

jest.mock('../api', () => ({ api: () => ({ health: jest.fn().mockResolvedValue(true) }) }));

function renderShell() {
  return renderRouter(
    {
      '(tabs)/_layout': TabsLayout,
      '(tabs)/index': HomeScreen,
      '(tabs)/events': EventsScreen,
      '(tabs)/community': CommunityScreen,
      '(tabs)/market': MarketScreen,
      '(tabs)/travel': TravelScreen,
    },
    { initialUrl: '/', wrapper: ({ children }) => <TestProviders>{children}</TestProviders> },
  );
}

describe('app shell', () => {
  beforeEach(() => i18n.changeLanguage('fr'));

  it('opens on Home with the 5-tab bar', async () => {
    await renderShell();

    expect(await screen.findByRole('header', { name: 'Accueil' })).toBeOnTheScreen();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(screen.getByRole('tab', { name: 'Accueil' })).toBeSelected();
  });

  it('switches screens from the tab bar', async () => {
    await renderShell();
    await screen.findByRole('header', { name: 'Accueil' });

    await fireEvent.press(screen.getByRole('tab', { name: 'Sorties' }));

    expect(await screen.findByRole('header', { name: 'Sorties' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Sorties' })).toBeSelected();
  });

  it('shows the API check on Home in development', async () => {
    await renderShell();
    expect(await screen.findByText('API joignable')).toBeOnTheScreen();
  });
});
