import '../../global.css';
import '../i18n';

import { QueryClientProvider } from '@tanstack/react-query';
import {
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRootNavigationState,
  useRouter,
  useSegments,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { connectQueryManagers, createQueryClient } from '../api/queryClient';
import { gateState, homeFor, isAllowed, routeName } from '../auth/gate';
import { GateContext } from '../auth/GateContext';
import { consumeReturnTo, loadReturnTo, returnHref } from '../auth/returnTo';
import { SessionProvider } from '../auth/SessionProvider';
import { useMe } from '../auth/useMe';
import { useSession } from '../auth/useSession';
import { ScreenBackground } from '../components/ScreenBackground';
import { ToastProvider } from '../components/ToastProvider';
import { changeAppLanguage, restoreLocale } from '../i18n/localeStore';
import { colorValue } from '../theme/colors';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Screens are transparent so the one fixed shell gradient (ScreenBackground) shows through.
const TRANSPARENT_THEME = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colorValue('transparent') },
};

/**
 * The auth gate (proposal M-9). No token: Sorties in guest mode (US-15, AC-15.1), or Log in
 * after a refused token. A token:
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
    // The guest's return target (AC-15.7) is read with the language, before the gate decides.
    void Promise.all([restoreLocale(), loadReturnTo()]).finally(() => setLocaleRestored(true));
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
    // AC-15.7, AC-15.8: a guest who just logged in (or confirmed their email) goes back to
    // the event or search they were on.
    const target = state === 'ready' ? consumeReturnTo() : null;
    router.replace(target ? returnHref(target) : homeFor(state, session.reason));
  }, [navigationReady, state, allowed, router, session.reason]);

  // M-18: a session the server ended (token refused) goes to Log in once, even on a screen a
  // guest may see (US-15 lets a logged-out phone stay on Sorties).
  const endHandled = useRef(false);
  useEffect(() => {
    if (state !== 'signedOut') {
      endHandled.current = false;
      return;
    }
    if (!navigationReady || endHandled.current) return;
    endHandled.current = true;
    if (session.reason === 'unauthorized' && allowed && route !== 'log-in')
      router.replace('/log-in');
  }, [navigationReady, state, allowed, route, router, session.reason]);

  useEffect(() => {
    if (allowed) void SplashScreen.hideAsync().catch(() => undefined);
  }, [allowed]);

  return (
    <GateContext.Provider value={state}>
      <ThemeProvider value={TRANSPARENT_THEME}>
        <ToastProvider
          aboveTabBar={(state === 'ready' || state === 'signedOut') && route === '(tabs)'}
        >
          {/* dark-content over the gradient (contrast rule 8). */}
          <StatusBar style="dark" />
          <ScreenBackground />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colorValue('transparent') },
            }}
          />
        </ToastProvider>
      </ThemeProvider>
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
