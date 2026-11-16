import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INCREMENT_PAISE,
  DEFAULT_START_PENALTY_PAISE,
  MAX_DAILY_TARGET,
  PLAN_RULES,
  validateChallengeConfig,
  type ChallengeConfig,
} from '../../../src/domain/challenge/config';
import { evaluateDays, projectToday, summarize } from '../../../src/domain/challenge/evaluate';
import { penaltyRate, proportionalPenalty } from '../../../src/domain/challenge/penalty';
import { paise } from '../../../src/domain/money';

function config(overrides: Partial<ChallengeConfig> = {}): ChallengeConfig {
  return {
    planDays: 7,
    dailyTarget: 4,
    startPenaltyPaise: paise(2000),
    incrementPaise: paise(2000),
    timeZone: 'Asia/Kolkata',
    countManual: true,
    ...overrides,
  };
}

describe('plans', () => {
  it('defines the 7, 15 and 30-day rules', () => {
    expect(PLAN_RULES).toEqual({
      7: { graceDays: 2, requiredSuccessDays: 5 },
      15: { graceDays: 3, requiredSuccessDays: 12 },
      30: { graceDays: 5, requiredSuccessDays: 25 },
    });
  });

  it('defaults to ₹20 start and ₹20 increment', () => {
    expect(DEFAULT_START_PENALTY_PAISE).toBe(2000);
    expect(DEFAULT_INCREMENT_PAISE).toBe(2000);
  });
});

describe('validateChallengeConfig', () => {
  it('accepts a valid configuration', () => {
    expect(validateChallengeConfig(config())).toEqual({ ok: true, config: config() });
  });

  it.each([
    [{ planDays: 10 }, 'planDays'],
    [{ dailyTarget: 0 }, 'dailyTarget'],
    [{ dailyTarget: 2.5 }, 'dailyTarget'],
    [{ dailyTarget: MAX_DAILY_TARGET + 1 }, 'dailyTarget'],
    [{ timeZone: 'Nowhere/Land' }, 'timeZone'],
    [{ startPenaltyPaise: -100 }, 'startPenaltyPaise'],
    [{ startPenaltyPaise: 10_000_001 }, 'startPenaltyPaise'],
    [{ incrementPaise: 0.5 }, 'incrementPaise'],
    [{ incrementPaise: 10_000_001 }, 'incrementPaise'],
  ] as const)('rejects %o', (overrides, field) => {
    const result = validateChallengeConfig({ ...config(), ...overrides } as ChallengeConfig);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((i) => i.field)).toContain(field);
  });

  it('allows a zero increment (flat penalty)', () => {
    expect(validateChallengeConfig(config({ incrementPaise: paise(0) })).ok).toBe(true);
  });

  it('accepts a large daily target up to the maximum', () => {
    expect(validateChallengeConfig(config({ dailyTarget: MAX_DAILY_TARGET })).ok).toBe(true);
  });
});

describe('penalty rate and proportional penalty', () => {
  it('escalates by the increment per penalized day: ₹20, ₹40, ₹60, ₹80', () => {
    const c = config();
    expect([1, 2, 3, 4].map((i) => penaltyRate(c, i))).toEqual([2000, 4000, 6000, 8000]);
  });

  it('rejects penalized index < 1', () => {
    expect(() => penaltyRate(config(), 0)).toThrow(RangeError);
  });

  // PRD §8 example table, every row.
  it.each([
    [2000, 4, 4, 0],
    [2000, 3, 4, 500],
    [2000, 2, 4, 1000],
    [2000, 1, 4, 1500],
    [2000, 0, 4, 2000],
    [4000, 3, 4, 1000],
    [4000, 2, 4, 2000],
    [4000, 1, 4, 3000],
    [4000, 0, 4, 4000],
    [6000, 1, 4, 4500],
    [8000, 2, 4, 4000],
    [2000, 2, 3, 667],
    [2000, 1, 3, 1333],
    [2500, 7, 8, 313],
  ])('rate %i, solved %i/%i → %i paise', (rate, solved, target, expected) => {
    expect(proportionalPenalty(paise(rate), solved, target)).toBe(expected);
  });

  it('never charges for more than the target', () => {
    expect(proportionalPenalty(paise(2000), 9, 4)).toBe(0);
  });
});

describe('evaluateDays (the day fold)', () => {
  it('reproduces the worked 7-day example: ₹85 total, FAILED', () => {
    const c = config();
    const results = evaluateDays(c, [4, 3, 0, 0, 2, 0, 4]);
    expect(results.map((r) => [r.outcome, r.penalizedIndex, r.ratePaise, r.penaltyPaise])).toEqual([
      ['SUCCESS', null, null, 0],
      ['PARTIAL_PENALIZED', 1, 2000, 500],
      ['ZERO_GRACE', null, null, 0],
      ['ZERO_GRACE', null, null, 0],
      ['PARTIAL_PENALIZED', 2, 4000, 2000],
      ['ZERO_PENALIZED', 3, 6000, 6000],
      ['SUCCESS', null, null, 0],
    ]);
    expect(results.map((r) => r.graceUsedAfter)).toEqual([0, 0, 1, 2, 2, 2, 2]);

    const s = summarize(c, results);
    expect(s.totalPenaltyPaise).toBe(8500);
    expect(s.successDays).toBe(2);
    expect(s.outcome).toBe('FAILED');
  });

  it('recomputes deterministically when late data turns day 2 into a success: ₹50', () => {
    const c = config();
    const results = evaluateDays(c, [4, 4, 0, 0, 2, 0, 4]);
    expect(results.map((r) => r.penaltyPaise)).toEqual([0, 0, 0, 0, 1000, 4000, 0]);
    expect(summarize(c, results).totalPenaltyPaise).toBe(5000);
  });

  it('partial days are always penalized even while grace remains', () => {
    const results = evaluateDays(config(), [1]);
    expect(results[0]).toMatchObject({ outcome: 'PARTIAL_PENALIZED', graceUsedAfter: 0 });
  });

  it('grace days do not advance the penalty rate', () => {
    const results = evaluateDays(config(), [0, 0, 3]);
    expect(results[2]).toMatchObject({ penalizedIndex: 1, ratePaise: 2000, penaltyPaise: 500 });
  });

  it('exhausts exactly the plan grace allowance (15-day: 3)', () => {
    const results = evaluateDays(config({ planDays: 15 }), [0, 0, 0, 0]);
    expect(results.map((r) => r.outcome)).toEqual([
      'ZERO_GRACE',
      'ZERO_GRACE',
      'ZERO_GRACE',
      'ZERO_PENALIZED',
    ]);
  });

  it('target = 1 has no partial days', () => {
    const results = evaluateDays(config({ dailyTarget: 1 }), [1, 0, 0, 0]);
    expect(results.map((r) => r.outcome)).toEqual([
      'SUCCESS',
      'ZERO_GRACE',
      'ZERO_GRACE',
      'ZERO_PENALIZED',
    ]);
    expect(results[3]?.penaltyPaise).toBe(2000);
  });

  it('refuses more days than the plan length', () => {
    expect(() => evaluateDays(config(), [4, 4, 4, 4, 4, 4, 4, 4])).toThrow(RangeError);
  });

  it('refuses negative or fractional counts', () => {
    expect(() => evaluateDays(config(), [-1])).toThrow(RangeError);
    expect(() => evaluateDays(config(), [1.5])).toThrow(RangeError);
  });
});

describe('summarize (pass / fail)', () => {
  it('is IN_PROGRESS until every day is evaluated', () => {
    const c = config();
    expect(summarize(c, evaluateDays(c, [4, 4, 4])).outcome).toBe('IN_PROGRESS');
  });

  it('passes a 7-day challenge with exactly 5 successful days', () => {
    const c = config();
    const s = summarize(c, evaluateDays(c, [4, 4, 0, 4, 0, 4, 4]));
    expect(s).toMatchObject({ outcome: 'PASSED', successDays: 5, totalPenaltyPaise: 0 });
  });

  it('fails a 7-day challenge with 4 successful days', () => {
    const c = config();
    expect(summarize(c, evaluateDays(c, [4, 4, 0, 4, 0, 4, 3])).outcome).toBe('FAILED');
  });

  it('passes a 30-day challenge with 25 successes and fails with 24', () => {
    const c = config({ planDays: 30 });
    const pass = [...Array<number>(25).fill(4), ...Array<number>(5).fill(0)];
    const fail = [...Array<number>(24).fill(4), ...Array<number>(6).fill(0)];
    expect(summarize(c, evaluateDays(c, pass)).outcome).toBe('PASSED');
    expect(summarize(c, evaluateDays(c, fail)).outcome).toBe('FAILED');
  });

  it('passes a 15-day challenge with 12 successes', () => {
    const c = config({ planDays: 15 });
    const days = [...Array<number>(12).fill(4), 0, 0, 0];
    expect(summarize(c, evaluateDays(c, days))).toMatchObject({ outcome: 'PASSED', graceUsed: 3 });
  });

  it('reports when passing is no longer possible before the end', () => {
    const c = config();
    const s = summarize(c, evaluateDays(c, [0, 0, 0]));
    expect(s.outcome).toBe('IN_PROGRESS');
    expect(s.canStillPass).toBe(false);
    expect(summarize(c, evaluateDays(c, [0, 0])).canStillPass).toBe(true);
  });

  it('reports highest and average penalty over penalized days', () => {
    const c = config();
    const s = summarize(c, evaluateDays(c, [4, 3, 0, 0, 2, 0, 4]));
    expect(s.highestDayPenaltyPaise).toBe(6000);
    expect(s.penalizedDays).toBe(3);
  });
});

describe('projectToday (potential penalty)', () => {
  it('projects today as if it ended now, given closed days', () => {
    const c = config();
    expect(projectToday(c, [4, 3], 2)).toMatchObject({
      dayIndex: 2,
      outcome: 'PARTIAL_PENALIZED',
      penalizedIndex: 2,
      penaltyPaise: 2000,
    });
  });

  it('shows a zero day as a grace day while grace remains', () => {
    expect(projectToday(config(), [], 0)).toMatchObject({ outcome: 'ZERO_GRACE', penaltyPaise: 0 });
  });
});
