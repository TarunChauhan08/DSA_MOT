import { describe, expect, it } from 'vitest';
import { addDays, parseDayKey, type DayKey } from '../../../src/domain/calendar';
import {
  computeStreaks,
  intensityLevel,
  targetForDay,
  type DayActivity,
} from '../../../src/domain/streak/streak';

const START = parseDayKey('2026-11-01');

function days(spec: ReadonlyArray<readonly [number, number | null]>): DayActivity[] {
  return spec.map(([solved, target], i) => ({ day: addDays(START, i), solved, target }));
}

const lastDay = (d: DayActivity[]): DayKey => {
  const last = d.at(-1);
  if (!last) throw new Error('empty');
  return last.day;
};

describe('computeStreaks', () => {
  it('counts consecutive full-target days', () => {
    const d = days([
      [4, 4],
      [5, 4],
      [4, 4],
    ]);
    expect(computeStreaks(d, lastDay(d))).toMatchObject({ current: 3, longest: 3 });
  });

  it('a partial day breaks the streak', () => {
    const d = days([
      [4, 4],
      [3, 4],
      [4, 4],
    ]);
    expect(computeStreaks(d, lastDay(d))).toMatchObject({ current: 1, longest: 1 });
  });

  it('a zero (grace) day breaks the streak', () => {
    const d = days([
      [4, 4],
      [4, 4],
      [0, 4],
      [4, 4],
    ]);
    expect(computeStreaks(d, lastDay(d))).toMatchObject({ current: 1, longest: 2 });
  });

  it('an unfinished today does not break the current streak', () => {
    const d = days([
      [4, 4],
      [4, 4],
      [1, 4],
    ]);
    expect(computeStreaks(d, lastDay(d))).toMatchObject({ current: 2 });
  });

  it('a completed today extends the streak', () => {
    const d = days([
      [4, 4],
      [4, 4],
    ]);
    expect(computeStreaks(d, lastDay(d)).current).toBe(2);
  });

  it('days without a target (before any challenge) never count', () => {
    const d = days([
      [5, null],
      [4, 4],
    ]);
    expect(computeStreaks(d, lastDay(d))).toMatchObject({
      current: 1,
      successfulDays: 1,
      incompleteDays: 0,
      totalSolved: 9,
    });
  });

  it('a missing calendar day breaks the streak', () => {
    const d: DayActivity[] = [
      { day: START, solved: 4, target: 4 },
      { day: addDays(START, 2), solved: 4, target: 4 },
    ];
    expect(computeStreaks(d, addDays(START, 2))).toMatchObject({ current: 1, longest: 1 });
  });

  it('reports totals honestly (grace days are incomplete days)', () => {
    const d = days([
      [4, 4],
      [0, 4],
      [2, 4],
      [4, 4],
    ]);
    expect(computeStreaks(d, lastDay(d))).toMatchObject({
      successfulDays: 2,
      incompleteDays: 2,
      totalSolved: 10,
    });
  });

  it('an unfinished today is not counted as incomplete yet', () => {
    const d = days([
      [4, 4],
      [1, 4],
    ]);
    expect(computeStreaks(d, lastDay(d)).incompleteDays).toBe(0);
  });

  it('handles an empty history', () => {
    expect(computeStreaks([], START)).toEqual({
      current: 0,
      longest: 0,
      successfulDays: 0,
      incompleteDays: 0,
      totalSolved: 0,
    });
  });
});

describe('targetForDay', () => {
  const challenges = [
    { startDay: parseDayKey('2026-11-01'), dailyTarget: 3 },
    { startDay: parseDayKey('2026-11-20'), dailyTarget: 5 },
  ];

  it('uses the most recent challenge that started on or before the day', () => {
    expect(targetForDay(parseDayKey('2026-11-10'), challenges)).toBe(3);
    expect(targetForDay(parseDayKey('2026-11-20'), challenges)).toBe(5);
    expect(targetForDay(parseDayKey('2026-12-25'), challenges)).toBe(5);
  });

  it('returns null before any challenge', () => {
    expect(targetForDay(parseDayKey('2026-10-31'), challenges)).toBeNull();
    expect(targetForDay(parseDayKey('2026-10-31'), [])).toBeNull();
  });
});

describe('intensityLevel (heatmap light → deep green)', () => {
  it.each([
    [0, 4, 0],
    [1, 4, 1],
    [2, 4, 2],
    [3, 4, 2],
    [4, 4, 3],
    [5, 4, 3],
    [6, 4, 4],
    [10, 4, 4],
  ])('%i solved of %i → level %i', (solved, target, level) => {
    expect(intensityLevel(solved, target)).toBe(level);
  });

  it('uses absolute thresholds when no target applies', () => {
    expect([0, 1, 2, 3, 4, 6].map((n) => intensityLevel(n, null))).toEqual([0, 1, 2, 2, 3, 4]);
  });
});
