import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { memoryTokenStore } from '../test/fakes';
import { TestProviders } from '../test/render';
import { emitUnauthorized } from './sessionEvents';
import { SessionProvider } from './SessionProvider';
import { useSession } from './useSession';

function Status() {
  const { status, reason, signOut } = useSession();
  return (
    <Text onPress={() => void signOut()}>
      {status}
      {reason ? ` (${reason})` : ''}
    </Text>
  );
}

async function renderSession(token: string | null) {
  const tokenStore = memoryTokenStore(token);
  await render(
    <TestProviders>
      <SessionProvider tokenStore={tokenStore}>
        <Status />
      </SessionProvider>
    </TestProviders>,
  );
  return tokenStore;
}

describe('SessionProvider', () => {
  it('is signed in when the device holds a token', async () => {
    await renderSession('jwt');
    expect(await screen.findByText('signedIn')).toBeOnTheScreen();
  });

  it('is signed out without a token', async () => {
    await renderSession(null);
    expect(await screen.findByText('signedOut')).toBeOnTheScreen();
  });

  it('AC-3.4 signs out when the API refuses the token (401 unauthorized)', async () => {
    await renderSession('jwt');
    await screen.findByText('signedIn');

    await act(() => emitUnauthorized());

    // The gate then opens Log in rather than Welcome (M-18).
    await waitFor(() => expect(screen.getByText('signedOut (unauthorized)')).toBeOnTheScreen());
  });

  it('AC-3.5 remembers that the person logged out (Welcome, not Log in)', async () => {
    const tokenStore = await renderSession('jwt');
    await screen.findByText('signedIn');

    await fireEvent.press(screen.getByText('signedIn'));

    expect(await screen.findByText('signedOut (logout)')).toBeOnTheScreen();
    expect(tokenStore.value).toBeNull();
  });
});
