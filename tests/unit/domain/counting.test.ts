import { describe, expect, it } from 'vitest';
import { parseDayKey } from '../../../src/domain/calendar';
import {
  countDay,
  groupByDay,
  verificationOf,
  type CompletionFact,
} from '../../../src/domain/completion/counting';
import { makeSourceKey, soloCanonicalKey } from '../../../src/domain/identity/identity';

let seq = 0;
function fact(
  overrides: Partial<CompletionFact> & Pick<CompletionFact, 'evidence'>,
): CompletionFact {
  seq += 1;
  const sourceKey = overrides.sourceKey ?? makeSourceKey('leetcode', 'two-sum');
  return {
    id: `c${seq}`,
    sourceKey,
    canonicalKey: overrides.canonicalKey ?? soloCanonicalKey(sourceKey),
    sourceTimestampMs: Date.parse('2026-11-16T06:00:00Z') + seq,
    title: 'Two Sum',
    ...overrides,
  };
}

const lc = (slug: string) => makeSourceKey('leetcode', slug);
const tuf = (slug: string) => makeSourceKey('tuf', slug);

describe('verificationOf', () => {
  it('maps evidence to the four verification types', () => {
    expect(verificationOf('LC_RECENT_AC')).toBe('AUTO_VERIFIED');
    expect(verificationOf('TUF_SUBMISSION_ACCEPTED')).toBe('AUTO_VERIFIED');
    expect(verificationOf('TUF_SHEET_CHECKBOX')).toBe('MANUAL');
    expect(verificationOf('USER_MANUAL')).toBe('MANUAL');
  });
});

describe('countDay', () => {
  it('counts unique problems across both platforms', () => {
    const r = countDay(
      [
        fact({ evidence: 'LC_RECENT_AC', sourceKey: lc('two-sum') }),
        fact({ evidence: 'LC_RECENT_AC', sourceKey: lc('3sum') }),
        fact({ evidence: 'TUF_SHEET_CHECKBOX', sourceKey: tuf('selection-sort') }),
        fact({ evidence: 'TUF_SUBMISSION_ACCEPTED', sourceKey: tuf('bubble-sort') }),
      ],
      { countManual: true },
    );
    expect(r.count).toBe(4);
  });

  it('counts duplicate LeetCode accepts of the same problem once', () => {
    const r = countDay([fact({ evidence: 'LC_RECENT_AC' }), fact({ evidence: 'LC_RECENT_AC' })], {
      countManual: true,
    });
    expect(r.count).toBe(1);
    expect(r.entries.map((e) => e.status).sort()).toEqual(['COUNTED', 'DUPLICATE_EXCLUDED']);
  });

  it('counts the same problem from both platforms once when mapped to one canonical key', () => {
    const canonicalKey = soloCanonicalKey(lc('two-sum'));
    const r = countDay(
      [
        fact({ evidence: 'LC_RECENT_AC', sourceKey: lc('two-sum'), canonicalKey }),
        fact({ evidence: 'TUF_SUBMISSION_ACCEPTED', sourceKey: tuf('two-sum'), canonicalKey }),
      ],
      { countManual: true },
    );
    expect(r.count).toBe(1);
  });

  it('upgrades a manual entry when the same problem is auto-verified (counts once)', () => {
    const manual = fact({ evidence: 'USER_MANUAL' });
    const auto = fact({ evidence: 'LC_RECENT_AC' });
    const r = countDay([manual, auto], { countManual: true });
    expect(r.count).toBe(1);
    expect(r.entries.find((e) => e.fact.id === auto.id)?.status).toBe('COUNTED');
    expect(r.entries.find((e) => e.fact.id === manual.id)).toMatchObject({
      status: 'SUPERSEDED_BY_VERIFIED',
      countedAs: auto.id,
    });
  });

  it('excludes manual and sheet entries when manual counting is disabled', () => {
    const r = countDay(
      [
        fact({ evidence: 'USER_MANUAL', sourceKey: lc('a') }),
        fact({ evidence: 'TUF_SHEET_CHECKBOX', sourceKey: tuf('b') }),
        fact({ evidence: 'LC_RECENT_AC', sourceKey: lc('c') }),
      ],
      { countManual: false },
    );
    expect(r.count).toBe(1);
    expect(r.entries.filter((e) => e.status === 'MANUAL_DISABLED')).toHaveLength(2);
  });

  it('still counts an auto-verified problem that also has a manual entry when manual is disabled', () => {
    const r = countDay([fact({ evidence: 'USER_MANUAL' }), fact({ evidence: 'LC_RECENT_AC' })], {
      countManual: false,
    });
    expect(r.count).toBe(1);
  });

  it('is independent of input order', () => {
    const facts = [
      fact({ evidence: 'USER_MANUAL' }),
      fact({ evidence: 'LC_RECENT_AC' }),
      fact({ evidence: 'TUF_SHEET_CHECKBOX', sourceKey: tuf('x') }),
    ];
    const a = countDay(facts, { countManual: true });
    const b = countDay([...facts].reverse(), { countManual: true });
    expect(b.count).toBe(a.count);
    expect(new Map(b.entries.map((e) => [e.fact.id, e.status]))).toEqual(
      new Map(a.entries.map((e) => [e.fact.id, e.status])),
    );
  });

  it('breaks ties deterministically by id when evidence and time are equal', () => {
    const t = Date.parse('2026-11-16T06:00:00Z');
    const r = countDay(
      [
        fact({ id: 'b', evidence: 'LC_RECENT_AC', sourceTimestampMs: t }),
        fact({ id: 'a', evidence: 'LC_RECENT_AC', sourceTimestampMs: t }),
      ],
      { countManual: true },
    );
    expect(r.entries.find((e) => e.status === 'COUNTED')?.fact.id).toBe('a');
  });

  it('returns zero for an empty day', () => {
    expect(countDay([], { countManual: true })).toEqual({ count: 0, entries: [] });
  });
});

describe('groupByDay', () => {
  it('orders facts within a day by time, then id', () => {
    const t = Date.parse('2026-11-16T06:00:00Z');
    const groups = groupByDay(
      [
        fact({ id: 'z', evidence: 'LC_RECENT_AC', sourceTimestampMs: t }),
        fact({ id: 'y', evidence: 'LC_RECENT_AC', sourceTimestampMs: t }),
        fact({ id: 'x', evidence: 'LC_RECENT_AC', sourceTimestampMs: t - 1 }),
      ],
      'Asia/Kolkata',
    );
    expect(groups.get(parseDayKey('2026-11-16'))?.map((f) => f.id)).toEqual(['x', 'y', 'z']);
  });

  it('attributes by source timestamp in the time zone, not discovery time', () => {
    const late = fact({
      evidence: 'LC_RECENT_AC',
      sourceTimestampMs: Date.parse('2026-11-15T18:29:00Z'), // 23:59 IST on the 15th
    });
    const early = fact({
      evidence: 'LC_RECENT_AC',
      sourceTimestampMs: Date.parse('2026-11-15T18:31:00Z'), // 00:01 IST on the 16th
    });
    const groups = groupByDay([late, early], 'Asia/Kolkata');
    expect(groups.get(parseDayKey('2026-11-15'))?.map((f) => f.id)).toEqual([late.id]);
    expect(groups.get(parseDayKey('2026-11-16'))?.map((f) => f.id)).toEqual([early.id]);
  });
});
