import { useIsGuest } from '../../auth/GateContext';
import { GuestTabScreen } from '../../screens/guest/GuestTabScreen';
import { ComingSoonScreen } from '../../screens/ComingSoonScreen';

export default function MarketScreen() {
  // Guests: what Services will do, and the invitation to sign up (AC-15.6).
  if (useIsGuest()) return <GuestTabScreen tab="market" />;
  // Members: the same panel with « Bientôt » until the module ships (PM 2026-10-07).
  return <ComingSoonScreen tab="market" />;
}
