import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { memoryTokenStore } from '../test/fakes';
import { TestProviders } from '../test/render';
import { emitUnauthorized } from './sessionEvents';
import { SessionProvider } from './SessionProvider';
import { useSession } from './useSession';

function Status() {
  return <Text>{useSession().status}</Text>;
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

    await waitFor(() => expect(screen.getByText('signedOut')).toBeOnTheScreen());
  });
});
