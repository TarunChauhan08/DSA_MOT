import { describe, expect, it } from 'vitest';
import { addDays, parseDayKey, type DayKey } from '../../../src/domain/calendar';
import { completionRate } from '../../../src/domain/analytics/rates';
import { penaltyStats } from '../../../src/domain/analytics/penaltyStats';
import { heatmapWeeks, weekdayIndex } from '../../../src/domain/analytics/heatmap';
import { savingForOneMore, urgencyLevel } from '../../../src/domain/analytics/nudges';
import type { ChallengeConfig } from '../../../src/domain/challenge/config';
import { paise } from '../../../src/domain/money';
import type { DayActivity } from '../../../src/domain/streak/streak';

const TODAY = parseDayKey('2026-11-18'); // a Wednesday
const HOUR = 3_600_000;

function history(solvedNewestLast: Array<number | null>, target = 4): DayActivity[] {
  const n = solvedNewestLast.length;
  return solvedNewestLast.map((s, i) => ({
    day: addDays(TODAY, i - n + 1),
    solved: s ?? 0,
    target: s === null ? null : target,
  }));
}

describe('completionRate (rolling, closed days only)', () => {
  it('counts full-target days over the last 7 closed days', () => {
    // Nov 11..17 closed = [4,4,2,0,4,5,1] → 4 full days of 7; today (Nov 18) is ignored.
    const h = history([4, 4, 2, 0, 4, 5, 1, 4]);
    expect(completionRate(h, TODAY, 7)).toEqual({ successDays: 4, eligibleDays: 7, percent: 57 });
  });

  it('ignores days without a target and days outside the window', () => {
    // Nov 14 ✓, Nov 15 ✗, Nov 16 no target, Nov 17 ✓, Nov 18 today.
    const h = history([4, 0, null, 4, 4]);
    expect(completionRate(h, TODAY, 2)).toEqual({ successDays: 1, eligibleDays: 1, percent: 100 });
    expect(completionRate(h, TODAY, 30)).toEqual({ successDays: 2, eligibleDays: 3, percent: 67 });
  });

  it('is null when nothing is eligible yet', () => {
    expect(completionRate(history([3]), TODAY, 7)).toEqual({
      successDays: 0,
      eligibleDays: 0,
      percent: null,
    });
  });
});

describe('penaltyStats', () => {
  const days = [
    { penaltyPaise: paise(0), penalized: false },
    { penaltyPaise: paise(500), penalized: true },
    { penaltyPaise: paise(0), penalized: false },
    { penaltyPaise: paise(2000), penalized: true },
    { penaltyPaise: paise(6000), penalized: true },
  ];

  it('reports total, highest and both averages in exact paise', () => {
    expect(penaltyStats(days)).toEqual({
      totalPaise: 8500,
      highestPaise: 6000,
      evaluatedDays: 5,
      penalizedDays: 3,
      averagePerDayPaise: 1700,
      averagePerPenalizedDayPaise: 2833, // 8500 / 3 = 2833.33 → 2833
    });
  });

  it('handles no days', () => {
    expect(penaltyStats([])).toEqual({
      totalPaise: 0,
      highestPaise: 0,
      evaluatedDays: 0,
      penalizedDays: 0,
      averagePerDayPaise: 0,
      averagePerPenalizedDayPaise: 0,
    });
  });
});

describe('heatmapWeeks', () => {
  it('knows weekdays (Mon = 0)', () => {
    expect(weekdayIndex(parseDayKey('2026-11-16'))).toBe(0);
    expect(weekdayIndex(TODAY)).toBe(2);
    expect(weekdayIndex(parseDayKey('2026-11-22'))).toBe(6);
  });

  it('lays out full Monday-first weeks ending with the current week', () => {
    const h = history([4, 2, 0, 6]); // Nov 15 (Sun) .. Nov 18 (Wed)
    const weeks = heatmapWeeks(h, TODAY, 2);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]?.[0]?.day).toBe('2026-11-09');
    expect(weeks[1]?.[6]?.day).toBe('2026-11-22');
    const cell = (d: string) => weeks.flat().find((c) => c.day === (d as DayKey));
    expect(cell('2026-11-15')).toMatchObject({ solved: 4, level: 3, future: false, tracked: true });
    expect(cell('2026-11-16')).toMatchObject({ solved: 2, level: 2 });
    expect(cell('2026-11-17')).toMatchObject({ solved: 0, level: 0, tracked: true });
    expect(cell('2026-11-18')).toMatchObject({ solved: 6, level: 4, today: true });
    expect(cell('2026-11-19')).toMatchObject({ future: true, level: 0 });
    expect(cell('2026-11-10')).toMatchObject({ tracked: false, level: 0 });
  });
});

describe('nudges', () => {
  it.each([
    [10 * HOUR, false, 'calm'],
    [6 * HOUR, false, 'heads-up'],
    [2 * HOUR + 1, false, 'heads-up'],
    [2 * HOUR, false, 'urgent'],
    [5 * 60_000, false, 'urgent'],
    [1 * HOUR, true, 'done'],
  ] as const)('%i ms left (met=%s) → %s', (ms, met, level) => {
    expect(urgencyLevel(ms, met)).toBe(level);
  });

  const cfg: ChallengeConfig = {
    planDays: 7,
    dailyTarget: 4,
    startPenaltyPaise: paise(2000),
    incrementPaise: paise(2000),
    timeZone: 'Asia/Kolkata',
    countManual: true,
  };

  it('tells how much one more problem saves on a partial day', () => {
    expect(savingForOneMore(cfg, [], 1)).toBe(500); // ₹15 → ₹10
    expect(savingForOneMore(cfg, [], 3)).toBe(500); // ₹5 → ₹0
  });

  it('is negative when a zero day is still protected by grace (partial days are always charged)', () => {
    expect(savingForOneMore(cfg, [], 0)).toBe(-1500);
  });

  it('is the full rate minus the partial charge once grace is gone', () => {
    expect(savingForOneMore(cfg, [0, 0], 0)).toBe(500); // ₹20 → ₹15
  });

  it('is zero once the target is met', () => {
    expect(savingForOneMore(cfg, [], 4)).toBe(0);
  });
});
