import { addDays, type DayKey } from '../calendar';
import type { DayActivity } from '../streak/streak';

export interface CompletionRate {
  readonly successDays: number;
  readonly eligibleDays: number;
  /** Whole percent, or null when no closed day in the window had a target. */
  readonly percent: number | null;
}

const PERCENT = 100;

/** Share of closed days in the last `windowDays` (today excluded) where the target was met. */
export function completionRate(
  history: readonly DayActivity[],
  today: DayKey,
  windowDays: number,
): CompletionRate {
  const first = addDays(today, -windowDays);
  const inWindow = history.filter((d) => d.day >= first && d.day < today && d.target !== null);
  const successDays = inWindow.filter((d) => d.target !== null && d.solved >= d.target).length;
  const eligibleDays = inWindow.length;
  return {
    successDays,
    eligibleDays,
    percent: eligibleDays === 0 ? null : Math.round((successDays * PERCENT) / eligibleDays),
  };
}
