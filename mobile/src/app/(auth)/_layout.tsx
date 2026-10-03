import { Stack } from 'expo-router';

import { colorValue } from '../../theme/colors';

/** Screens for devices without a session (S1, S2, S5, S6, S7): neutral base, no tab bar. */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colorValue('shell') } }}
    />
  );
}
