import type { UseMutationResult } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

/**
 * Sends a form once until its request settles (QA BUG-A03): a double tap, or the keyboard's
 * "go" / "done" key pressed twice, never sends two requests. The button already shows its
 * loading state; the keyboard key doesn't, so the guard lives here.
 */
export function useSubmitOnce<TData, TError, TVariables, TContext>(
  mutation: UseMutationResult<TData, TError, TVariables, TContext>,
) {
  const inFlight = useRef(false);
  const { mutate } = mutation;
  return useCallback(
    (variables: TVariables) => {
      if (inFlight.current) return;
      inFlight.current = true;
      mutate(variables, {
        onSettled: () => {
          inFlight.current = false;
        },
      });
    },
    [mutate],
  );
}
