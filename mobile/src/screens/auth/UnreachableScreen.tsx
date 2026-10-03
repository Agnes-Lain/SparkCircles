import { SafeAreaView } from 'react-native-safe-area-context';

import { useMe } from '../../auth/useMe';
import { UnreachableNotification } from './UnreachableNotification';

/**
 * The device holds a token but GET /me couldn't reach the API (offline at app start): the
 * designed error notification with "Try again" instead of a dead screen (M-20). Logged-in
 * people never see Welcome again just because they're offline (AC-3.4).
 */
export function UnreachableScreen() {
  const me = useMe();
  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      className="flex-1 justify-center bg-shell px-lg"
      testID="unreachable-screen"
    >
      <UnreachableNotification onRetry={() => void me.refetch()} retrying={me.isFetching} />
    </SafeAreaView>
  );
}
