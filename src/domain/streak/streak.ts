import { daysBetween, type DayKey } from '../calendar';

export interface DayActivity {
  readonly day: DayKey;
  readonly solved: number;
  /** Target in force that day, or null before any challenge existed. */
  readonly target: number | null;
}

export interface StreakStats {
  readonly current: number;
  readonly longest: number;
  readonly successfulDays: number;
  /** Finished days with a target that was not met (partial, grace and zero days). */
  readonly incompleteDays: number;
  readonly totalSolved: number;
}

const isSuccess = (d: DayActivity) => d.target !== null && d.solved >= d.target;

/**
 * DSA streak (PRD §9), independent of challenge pass/fail. Only full-target days extend it.
 * An unfinished `today` neither extends nor breaks it.
 */
export function computeStreaks(history: readonly DayActivity[], today: DayKey): StreakStats {
  const days = [...history].sort((a, b) => (a.day < b.day ? -1 : 1));
  let run = 0;
  let longest = 0;
  let successfulDays = 0;
  let incompleteDays = 0;
  let totalSolved = 0;
  let previous: DayKey | null = null;

  for (const d of days) {
    totalSolved += d.solved;
    if (previous !== null && daysBetween(previous, d.day) > 1) run = 0;
    previous = d.day;

    if (isSuccess(d)) {
      run += 1;
      successfulDays += 1;
      longest = Math.max(longest, run);
    } else if (d.day !== today) {
      run = 0;
      if (d.target !== null) incompleteDays += 1;
    }
  }

  const stale = previous === null || daysBetween(previous, today) > 1;
  return { current: stale ? 0 : run, longest, successfulDays, incompleteDays, totalSolved };
}

/** Owner decision Q10: outside a challenge, the most recent challenge's target applies. */
export function targetForDay(
  day: DayKey,
  challenges: ReadonlyArray<{ readonly startDay: DayKey; readonly dailyTarget: number }>,
): number | null {
  let best: { startDay: DayKey; dailyTarget: number } | null = null;
  for (const c of challenges) {
    if (c.startDay <= day && (best === null || c.startDay >= best.startDay)) best = c;
  }
  return best?.dailyTarget ?? null;
}

export type IntensityLevel = 0 | 1 | 2 | 3 | 4;

/** Absolute thresholds used when no target applies: 1 / 2 / 4 / 6 problems. */
const ABSOLUTE_LEVELS = [1, 2, 4, 6] as const;

/**
 * Heatmap shade, light → deep green (owner decision). With a target:
 * 1 = under half, 2 = half or more, 3 = target met, 4 = 150% or more.
 */
export function intensityLevel(solved: number, target: number | null): IntensityLevel {
  if (solved <= 0) return 0;
  if (target === null) {
    if (solved >= ABSOLUTE_LEVELS[3]) return 4;
    if (solved >= ABSOLUTE_LEVELS[2]) return 3;
    if (solved >= ABSOLUTE_LEVELS[1]) return 2;
    return 1;
  }
  if (2 * solved < target) return 1;
  if (solved < target) return 2;
  if (2 * solved < 3 * target) return 3;
  return 4;
}
