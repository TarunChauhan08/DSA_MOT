import type { ChallengeConfig } from '../challenge/config';
import { projectToday } from '../challenge/evaluate';

export type Urgency = 'done' | 'calm' | 'heads-up' | 'urgent';

const HOUR_MS = 3_600_000;
/** Time-pressure tiers for an unfinished day (docs/DESIGN.md). */
export const HEADS_UP_BELOW_MS = 6 * HOUR_MS;
export const URGENT_AT_OR_BELOW_MS = 2 * HOUR_MS;

export function urgencyLevel(msLeftToday: number, targetMet: boolean): Urgency {
  if (targetMet) return 'done';
  if (msLeftToday <= URGENT_AT_OR_BELOW_MS) return 'urgent';
  if (msLeftToday <= HEADS_UP_BELOW_MS) return 'heads-up';
  return 'calm';
}

/**
 * Paise saved by solving one more problem today (if the day ended right after).
 * Negative while a zero day is still covered by grace: partial days are always charged.
 */
export function savingForOneMore(
  config: ChallengeConfig,
  closedDayCounts: readonly number[],
  todaySolved: number,
): number {
  const now = projectToday(config, closedDayCounts, todaySolved).penaltyPaise;
  const next = projectToday(config, closedDayCounts, todaySolved + 1).penaltyPaise;
  return now - next;
}
