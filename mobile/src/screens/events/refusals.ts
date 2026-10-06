import type { TFunction } from 'i18next';

import type { ApiError } from '../../api/errors';
import type { SparkEvent } from '../../api/events';

// QA BUG-3: every refusal code of the contract (docs/api/events.md, section 1) shows the
// designed message for the event's real state, never "We couldn't reach SparkCircles".

/** Why an event can't be joined or edited any more, from its state now. */
export type ClosedReason = 'unavailable' | 'cancelled' | 'onHold' | 'started' | 'notEditable';

/** The codes that mean "the event changed meanwhile": refresh it and say why. */
const REFUSALS = new Set<string>([
  'event_not_joinable',
  'event_not_editable',
  'event_not_draft',
  'event_started',
  'forbidden',
  'not_found',
]);

export function isRefusal(error: ApiError): boolean {
  return REFUSALS.has(error.code);
}

/**
 * The reason from the event fetched again (`undefined` = 404/403, not visible any more).
 * `editing`: the host's form, where an ended event "can't be changed any more".
 */
export function closedReason(
  event: SparkEvent | undefined,
  { editing = false }: { editing?: boolean } = {},
): ClosedReason {
  if (!event) return 'unavailable';
  if (event.status === 'cancelled') return 'cancelled';
  if (event.status === 'suspended') return 'onHold';
  if (editing) return 'notEditable';
  return 'started';
}

/** The designed title and caption for a reason (design E2, E9 and E5 copy). */
export function refusalText(
  reason: ClosedReason,
  t: TFunction,
  isHost = false,
): { title: string; caption?: string } {
  switch (reason) {
    case 'unavailable':
      return { title: t('events.detail.notFoundTitle'), caption: t('events.detail.notFoundBody') };
    case 'cancelled':
      return isHost
        ? { title: t('events.detail.hostCancelledTitle') }
        : { title: t('events.detail.cancelledTitle'), caption: t('events.detail.cancelledBody') };
    case 'onHold':
      return isHost
        ? {
            title: t('events.detail.hostOnHoldTitle'),
            caption: t('events.detail.hostOnHoldCaption'),
          }
        : { title: t('events.detail.onHoldTitle'), caption: t('events.detail.onHoldBody') };
    case 'notEditable':
      return { title: t('events.form.notEditable') };
    default:
      return { title: t('events.detail.started') };
  }
}
