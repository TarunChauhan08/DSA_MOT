import { addDays, type DayKey } from '../calendar';
import { intensityLevel, type DayActivity, type IntensityLevel } from '../streak/streak';

export interface HeatCell {
  readonly day: DayKey;
  readonly solved: number;
  readonly target: number | null;
  readonly level: IntensityLevel;
  /** Inside the tracked history (on or after the first tracked day). */
  readonly tracked: boolean;
  readonly today: boolean;
  readonly future: boolean;
}

const DAYS_PER_WEEK = 7;

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(day: DayKey): number {
  const sundayFirst = new Date(`${day}T00:00:00Z`).getUTCDay();
  return (sundayFirst + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
}

/** `weeks` Monday-first columns ending with the week that contains `today`. */
export function heatmapWeeks(
  history: readonly DayActivity[],
  today: DayKey,
  weeks: number,
): HeatCell[][] {
  const byDay = new Map(history.map((d) => [d.day, d]));
  const firstMonday = addDays(today, -weekdayIndex(today) - (weeks - 1) * DAYS_PER_WEEK);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: DAYS_PER_WEEK }, (_, d): HeatCell => {
      const day = addDays(firstMonday, w * DAYS_PER_WEEK + d);
      const activity = byDay.get(day);
      const future = day > today;
      return {
        day,
        solved: activity?.solved ?? 0,
        target: activity?.target ?? null,
        level:
          future || activity === undefined ? 0 : intensityLevel(activity.solved, activity.target),
        tracked: activity !== undefined,
        today: day === today,
        future,
      };
    }),
  );
}
