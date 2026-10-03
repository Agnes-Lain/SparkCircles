import '../../global.css';
import '../i18n';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { connectQueryManagers, createQueryClient } from '../api/queryClient';
import { gateState, homeFor, isAllowed, routeName } from '../auth/gate';
import { GateContext } from '../auth/GateContext';
import { SessionProvider } from '../auth/SessionProvider';
import { useMe } from '../auth/useMe';
import { useSession } from '../auth/useSession';
import { ToastProvider } from '../components/ToastProvider';
import { changeAppLanguage, restoreLocale } from '../i18n/localeStore';
import { colorValue } from '../theme/colors';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * The auth gate (proposal M-9). No token: Welcome (or Log in after a refused token). A token:
 * GET /me, then by account state, in the API's order: email not confirmed → Check your inbox
 * (AC-2.3), closure pending → Closure in progress (AC-11.3), new terms → Terms updated
 * (AC-5.5), otherwise the tabs. Reopening the app with a valid token skips Welcome (AC-3.4).
 * Email-link routes stay reachable in every state. The splash stays up until the device is
 * on a screen it may see.
 */
function RootNavigator() {
  const session = useSession();
  const me = useMe();
  const router = useRouter();
  const segments = useSegments();
  const navigationReady = Boolean(useRootNavigationState()?.key);

  const [localeRestored, setLocaleRestored] = useState(false);
  useEffect(() => {
    void restoreLocale().finally(() => setLocaleRestored(true));
  }, []);

  // Once logged in, the account's language wins (M-21).
  const accountLocale = me.data?.locale;
  useEffect(() => {
    if (accountLocale) void changeAppLanguage(accountLocale);
  }, [accountLocale]);

  const state = localeRestored ? gateState(session.status, me.data, me.error) : 'loading';
  const route = routeName(segments);
  const allowed = isAllowed(state, route);

  useEffect(() => {
    if (!navigationReady || state === 'loading' || allowed) return;
    router.replace(homeFor(state, session.reason));
  }, [navigationReady, state, allowed, router, session.reason]);

  useEffect(() => {
    if (allowed) void SplashScreen.hideAsync().catch(() => undefined);
  }, [allowed]);

  return (
    <GateContext.Provider value={state}>
      <ToastProvider aboveTabBar={state === 'ready' && route === '(tabs)'}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colorValue('shell') },
          }}
        />
      </ToastProvider>
    </GateContext.Provider>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  useEffect(() => connectQueryManagers(), []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <RootNavigator />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
