import { useIsGuest } from '../../auth/GateContext';
import { GuestTabScreen } from '../../screens/guest/GuestTabScreen';
import { MySpaceScreen } from '../../screens/mySpace/MySpaceScreen';

/**
 * My space (spec my-space): « Aujourd'hui | Mon compte ». Guests get the explanation screen
 * and the invitation to sign up, no personal call (AC-G.1, events AC-15.5, AC-15.6).
 */
export default function MySpaceTab() {
  if (useIsGuest()) return <GuestTabScreen tab="mySpace" />;
  return <MySpaceScreen />;
}
