import { Redirect } from 'expo-router';

import { useMe } from '../auth/useMe';

/**
 * App link `verification` (event emails: "your events are on hold"): V5 status when a
 * verification is pending or in place, otherwise V0 to verify.
 */
export default function VerificationLink() {
  const verification = useMe().data?.verification;
  const showStatus =
    verification?.status === 'pending' ||
    verification?.renewal?.status === 'pending' ||
    verification?.verified === true;
  return <Redirect href={showStatus ? '/verify/status' : '/verify'} />;
}
