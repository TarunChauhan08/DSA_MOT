import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { addDays, dayKeyOf, parseDayKey, startOfDayMs } from '../../../src/domain/calendar';
import {
  PLAN_RULES,
  type ChallengeConfig,
  type PlanDays,
} from '../../../src/domain/challenge/config';
import { evaluateDays, summarize } from '../../../src/domain/challenge/evaluate';
import {
  countDay,
  type CompletionFact,
  type Evidence,
} from '../../../src/domain/completion/counting';
import { makeSourceKey, type CanonicalKey } from '../../../src/domain/identity/identity';
import { paise, roundHalfUpDiv } from '../../../src/domain/money';

const configArb = fc.record({
  planDays: fc.constantFrom<PlanDays>(7, 15, 30),
  dailyTarget: fc.integer({ min: 1, max: 100 }),
  startPenaltyPaise: fc.integer({ min: 0, max: 10_000_000 }).map(paise),
  incrementPaise: fc.integer({ min: 0, max: 10_000_000 }).map(paise),
  timeZone: fc.constant('Asia/Kolkata'),
  countManual: fc.boolean(),
}) satisfies fc.Arbitrary<ChallengeConfig>;

const scenarioArb = configArb.chain((config) =>
  fc
    .array(fc.integer({ min: 0, max: config.dailyTarget + 3 }), { maxLength: config.planDays })
    .map((counts) => ({ config, counts })),
);

describe('penalty fold invariants', () => {
  it('total = sum of day penalties; grace days are never charged; grace ≤ allowance', () => {
    fc.assert(
      fc.property(scenarioArb, ({ config, counts }) => {
        const results = evaluateDays(config, counts);
        const summary = summarize(config, results);
        expect(summary.totalPenaltyPaise).toBe(results.reduce((t, r) => t + r.penaltyPaise, 0));
        for (const r of results) {
          if (r.outcome === 'SUCCESS' || r.outcome === 'ZERO_GRACE') expect(r.penaltyPaise).toBe(0);
          if (r.ratePaise !== null) expect(r.penaltyPaise).toBeLessThanOrEqual(r.ratePaise);
        }
        expect(summary.graceUsed).toBeLessThanOrEqual(PLAN_RULES[config.planDays].graceDays);
      }),
    );
  });

  it('is prefix-stable: later days never change earlier results', () => {
    fc.assert(
      fc.property(scenarioArb, fc.nat(), ({ config, counts }, cut) => {
        const k = counts.length === 0 ? 0 : cut % (counts.length + 1);
        expect(evaluateDays(config, counts.slice(0, k))).toEqual(
          evaluateDays(config, counts).slice(0, k),
        );
      }),
    );
  });

  it('is deterministic (recompute is idempotent)', () => {
    fc.assert(
      fc.property(scenarioArb, ({ config, counts }) => {
        expect(evaluateDays(config, counts)).toEqual(evaluateDays(config, counts));
      }),
    );
  });

  it('penalized days form the sequence 1, 2, 3… with non-decreasing rates', () => {
    fc.assert(
      fc.property(scenarioArb, ({ config, counts }) => {
        const penalized = evaluateDays(config, counts).filter((r) => r.penalizedIndex !== null);
        penalized.forEach((r, i) => {
          expect(r.penalizedIndex).toBe(i + 1);
        });
        for (let i = 1; i < penalized.length; i += 1) {
          expect(penalized[i]?.ratePaise ?? 0).toBeGreaterThanOrEqual(
            penalized[i - 1]?.ratePaise ?? 0,
          );
        }
      }),
    );
  });

  it('solving more on any day never increases the total penalty', () => {
    fc.assert(
      fc.property(scenarioArb, fc.nat(), ({ config, counts }, pick) => {
        if (counts.length === 0) return;
        const i = pick % counts.length;
        const better = counts.map((c, j) => (j === i ? c + 1 : c));
        const before = summarize(config, evaluateDays(config, counts)).totalPenaltyPaise;
        const after = summarize(config, evaluateDays(config, better)).totalPenaltyPaise;
        // A zero day that becomes partial can lose grace protection, so only compare
        // when the improved day was already non-zero.
        if ((counts[i] ?? 0) > 0) expect(after).toBeLessThanOrEqual(before);
      }),
    );
  });
});

describe('rounding', () => {
  it('roundHalfUpDiv equals exact rational half-up rounding (BigInt reference)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e12 }), fc.integer({ min: 1, max: 1000 }), (n, d) => {
        const ref = (2n * BigInt(n) + BigInt(d)) / (2n * BigInt(d));
        expect(BigInt(roundHalfUpDiv(n, d))).toBe(ref);
      }),
    );
  });
});

describe('calendar', () => {
  const zones = ['Asia/Kolkata', 'America/New_York', 'Europe/London', 'Australia/Sydney', 'UTC'];
  it('startOfDayMs round-trips through dayKeyOf in many zones', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 20_000 }), fc.constantFrom(...zones), (offset, tz) => {
        const day = addDays(parseDayKey('2000-01-01'), offset);
        const start = startOfDayMs(day, tz);
        expect(dayKeyOf(start, tz)).toBe(day);
        expect(dayKeyOf(start - 1, tz)).toBe(addDays(day, -1));
      }),
    );
  });
});

describe('counting invariants', () => {
  const evidenceArb = fc.constantFrom<Evidence>(
    'LC_RECENT_AC',
    'TUF_SUBMISSION_ACCEPTED',
    'TUF_SHEET_CHECKBOX',
    'USER_MANUAL',
  );
  const factsArb = fc
    .array(
      fc.record({
        slug: fc.constantFrom('a', 'b', 'c', 'd'),
        evidence: evidenceArb,
        t: fc.nat(1000),
      }),
      { maxLength: 12 },
    )
    .map((rows) =>
      rows.map((r, i): CompletionFact => ({
        id: `f${i}`,
        sourceKey: makeSourceKey('leetcode', r.slug),
        canonicalKey: `lc:${r.slug}` as CanonicalKey,
        evidence: r.evidence,
        sourceTimestampMs: r.t,
        title: r.slug,
      })),
    );

  it('count ≤ distinct problems, is order-independent, and manual-off never counts more', () => {
    fc.assert(
      fc.property(factsArb, fc.boolean(), (facts, countManual) => {
        const r = countDay(facts, { countManual });
        expect(r.count).toBeLessThanOrEqual(new Set(facts.map((f) => f.canonicalKey)).size);
        expect(r.entries).toHaveLength(facts.length);
        expect(countDay([...facts].reverse(), { countManual }).count).toBe(r.count);
        expect(countDay(facts, { countManual: false }).count).toBeLessThanOrEqual(
          countDay(facts, { countManual: true }).count,
        );
        expect(r.entries.filter((e) => e.status === 'COUNTED')).toHaveLength(r.count);
      }),
    );
  });
});
