import { Redirect } from 'expo-router';

/**
 * `/account` (e-mail and app links, back fallbacks of the account screens) opens My space on
 * « Mon compte » (spec my-space AC-7.4); the `/account/*` screens stay pushed screens.
 */
export default function AccountLink() {
  return <Redirect href="/my-space?view=account" />;
}
