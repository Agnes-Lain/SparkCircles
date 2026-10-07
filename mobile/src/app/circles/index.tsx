import { Redirect } from 'expo-router';

/** The `circles` app link of circle e-mails opens the Cercles tab. */
export default function CirclesLink() {
  return <Redirect href="/community" />;
}
