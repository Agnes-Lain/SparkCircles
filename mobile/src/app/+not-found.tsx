import { Redirect } from 'expo-router';

/**
 * Unknown paths, e.g. an email link for a screen of a later PR (`/my-data`): back to the
 * start, where the auth gate opens the right screen.
 */
export default function NotFound() {
  return <Redirect href="/" />;
}
