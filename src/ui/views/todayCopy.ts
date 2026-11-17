import type { DashboardView } from '../../application/queries';
import { formatInr, plural, streakLabel } from '../format';

export interface TodayCopy {
  readonly headline: string;
  readonly detail: string;
  /** Loss-framed streak warning while the streak is at risk today. */
  readonly streakWarning: string | null;
}

/**
 * The words around the day ring (docs/DESIGN.md): concrete, loss-framed when
 * something is at stake, never inventing pressure that the rules do not create.
 */
export function todayCopy(view: DashboardView): TodayCopy {
  const target = view.todayTarget;
  const solved = view.todaySolved;
  const streak = view.streak.current;
  if (target === null) {
    return {
      headline: 'No daily target yet.',
      detail: 'Start a challenge to set one.',
      streakWarning: null,
    };
  }
  const remaining = target - solved;
  if (remaining <= 0) {
    return {
      headline: 'Done for today.',
      detail: 'No virtual penalty today. See you tomorrow.',
      streakWarning: null,
    };
  }
  const streakWarning = streak > 0 ? `Your ${streakLabel(streak)} ends at midnight.` : null;
  const current = view.current;
  if (current === null) {
    return {
      headline: `${String(remaining)} more to go.`,
      detail: 'No challenge running, so no rupees are at stake today.',
      streakWarning,
    };
  }
  const projected = current.projectedToday;
  const stake = formatInr(projected.penaltyPaise);
  if (solved === 0 && projected.outcome === 'ZERO_GRACE') {
    return {
      headline: 'Nothing solved yet.',
      detail: `Ending at zero uses 1 of your ${plural(current.graceRemaining, 'grace day')}. Hit all ${String(target)} to keep it.`,
      streakWarning,
    };
  }
  if (solved === 0) {
    return {
      headline: 'Nothing solved yet.',
      detail: `${stake} at stake. Your grace days are used up.`,
      streakWarning,
    };
  }
  const saving = view.savingForOneMorePaise ?? 0;
  return {
    headline: `${String(remaining)} more to go.`,
    detail:
      saving > 0
        ? `${stake} at stake. Each problem now saves ${formatInr(saving)}.`
        : `${stake} at stake.`,
    streakWarning,
  };
}
