import { type Href, useRouter } from 'expo-router';
import { useCallback } from 'react';

/** Back button: the previous screen, or `fallback` when the screen was opened directly. */
export function useBack(fallback: Href) {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
