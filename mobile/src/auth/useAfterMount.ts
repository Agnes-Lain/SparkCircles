import { useEffect, useRef } from 'react';

/**
 * Runs `task` once, just after the first render committed and the navigator finished
 * mounting (an email link can open the app cold: navigating in a plain effect would run
 * before the root navigator is ready).
 */
export function useAfterMount(task: () => void) {
  const latest = useRef(task);
  useEffect(() => {
    latest.current = task;
  });
  useEffect(() => {
    const timer = setTimeout(() => latest.current(), 0);
    return () => clearTimeout(timer);
  }, []);
}
