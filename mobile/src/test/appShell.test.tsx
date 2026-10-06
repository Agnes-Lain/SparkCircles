import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import i18n from '../i18n';
import { TestProviders } from './render';
import TabsLayout from '../app/(tabs)/_layout';
import CommunityScreen from '../app/(tabs)/community';
import EventsScreen from '../app/(tabs)/index';
import MarketScreen from '../app/(tabs)/market';
import MySpaceScreen from '../app/(tabs)/my-space';
import TravelScreen from '../app/(tabs)/travel';

jest.mock('../api', () => ({ api: () => ({ health: jest.fn().mockResolvedValue(true) }) }));

function renderShell() {
  return renderRouter(
    {
      '(tabs)/_layout': TabsLayout,
      '(tabs)/index': EventsScreen,
      '(tabs)/community': CommunityScreen,
      '(tabs)/my-space': MySpaceScreen,
      '(tabs)/market': MarketScreen,
      '(tabs)/travel': TravelScreen,
    },
    { initialUrl: '/', wrapper: ({ children }) => <TestProviders>{children}</TestProviders> },
  );
}

describe('app shell', () => {
  beforeEach(() => i18n.changeLanguage('fr'));

  it('opens on Sorties, the default landing tab, with the 5-tab bar (v1.7)', async () => {
    await renderShell();

    expect(await screen.findByRole('header', { name: 'Sorties' })).toBeOnTheScreen();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(screen.getByRole('tab', { name: 'Sorties' })).toBeSelected();
  });

  it('switches screens from the tab bar', async () => {
    await renderShell();
    await screen.findByRole('header', { name: 'Sorties' });

    await fireEvent.press(screen.getByRole('tab', { name: 'Mon espace' }));

    expect(await screen.findByRole('header', { name: 'Mon espace' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Mon espace' })).toBeSelected();
  });

  it('shows the notifications bell in the My space header', async () => {
    await renderShell();
    await fireEvent.press(await screen.findByRole('tab', { name: 'Mon espace' }));
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeOnTheScreen();
  });

  it('shows the API check on My space in development', async () => {
    await renderShell();
    await fireEvent.press(await screen.findByRole('tab', { name: 'Mon espace' }));
    expect(await screen.findByText('API joignable')).toBeOnTheScreen();
  });
});
