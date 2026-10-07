import { router, Stack } from 'expo-router';
import { act, fireEvent, screen, within } from 'expo-router/testing-library';

import TabsLayout from '../../app/(tabs)/_layout';
import MySpaceTab from '../../app/(tabs)/my-space';
import AccountLink from '../../app/account/index';
import { ME_KEY } from '../../auth/useMe';
import i18n from '../../i18n';
import { mockCircles, resetApiMock } from '../../test/apiMock';
import { myCircles } from '../../test/circleFixtures';
import { meFixture } from '../../test/fixtures';
import { createTestQueryClient } from '../../test/render';
import { renderScreen, routeStub } from '../../test/renderScreen';

jest.mock('../../api', () => jest.requireActual('../../test/apiMock').apiModule);

function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

// In its own file: Expo Router's test store keeps the `_layout` states between tests.
const ROUTES = {
  _layout: RootLayout,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': routeStub('events'),
  '(tabs)/community': routeStub('community'),
  '(tabs)/my-space': MySpaceTab,
  '(tabs)/market': routeStub('market'),
  '(tabs)/travel': routeStub('travel'),
  'account/index': AccountLink,
  'account/security': routeStub('security'),
};

async function open(url: string) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(ME_KEY, meFixture);
  return renderScreen(ROUTES, { url, token: 'jwt', gate: 'ready', queryClient });
}

const tabBar = () => within(screen.getByTestId('tab-bar'));
const segment = (name: string) => screen.getByRole('tab', { name, selected: true });

beforeEach(async () => {
  resetApiMock();
  mockCircles.mine.mockResolvedValue({ items: [], limits: myCircles.limits });
  await i18n.changeLanguage('fr');
});

describe('My space segment (spec my-space: always opens on « Aujourd’hui »)', () => {
  it('opens on « Aujourd’hui » again when the tab comes back after another tab', async () => {
    await open('/my-space');
    await fireEvent.press(await screen.findByRole('tab', { name: 'Mon compte' }));
    expect(await screen.findByTestId('account-panel')).toBeOnTheScreen();

    await fireEvent.press(tabBar().getByRole('tab', { name: 'Sorties' }));
    expect(await screen.findByText('route:events')).toBeOnTheScreen();
    await fireEvent.press(tabBar().getByRole('tab', { name: 'Mon espace' }));
    expect(segment("Aujourd'hui")).toBeOnTheScreen();
    expect(screen.queryByTestId('account-panel')).toBeNull();
  });

  it('keeps « Mon compte » when coming back from a screen pushed from it', async () => {
    await open('/my-space');
    await fireEvent.press(await screen.findByRole('tab', { name: 'Mon compte' }));
    await act(() => router.push('/account/security'));
    expect(await screen.findByText('route:security')).toBeOnTheScreen();
    await act(() => router.back());
    expect(await screen.findByTestId('account-panel')).toBeOnTheScreen();
    expect(segment('Mon compte')).toBeOnTheScreen();
  });

  it('AC-7.4 the /account link opens « Mon compte », also from another tab', async () => {
    await open('/');
    expect(await screen.findByText('route:events')).toBeOnTheScreen();
    await act(() => router.navigate('/account'));
    expect(await screen.findByTestId('account-panel')).toBeOnTheScreen();
    expect(segment('Mon compte')).toBeOnTheScreen();
  });
});
