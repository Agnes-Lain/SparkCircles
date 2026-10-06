import { Stack } from 'expo-router';

import { VerificationFlowProvider } from '../../screens/verification/flow';
import { colorValue } from '../../theme/colors';

/** V0–V5 share the verification in progress; leaving the stack erases its photos. */
export default function VerifyLayout() {
  return (
    <VerificationFlowProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colorValue('transparent') },
        }}
      />
    </VerificationFlowProvider>
  );
}
