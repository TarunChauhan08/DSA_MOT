import { describe, expect, it } from 'vitest';
import {
  makeSourceKey,
  normalizeTitle,
  resolveCanonicalKeys,
  suggestDuplicates,
  type MappingDecision,
} from '../../../src/domain/identity/identity';

const lc = (s: string) => makeSourceKey('leetcode', s);
const tuf = (s: string) => makeSourceKey('tuf', s);

function decision(
  a: string,
  b: string,
  kind: MappingDecision['decision'],
  decidedAtMs = 1,
): MappingDecision {
  return {
    a: a as MappingDecision['a'],
    b: b as MappingDecision['b'],
    decision: kind,
    decidedAtMs,
  };
}

describe('makeSourceKey', () => {
  it('prefixes by platform and normalizes case', () => {
    expect(lc('Two-Sum')).toBe('lc:two-sum');
    expect(tuf('selection-sort')).toBe('tuf:selection-sort');
  });

  it('rejects untrusted or malformed slugs', () => {
    expect(() => lc('')).toThrow(RangeError);
    expect(() => lc('two sum')).toThrow(RangeError);
    expect(() => lc('<script>')).toThrow(RangeError);
    expect(() => lc('a'.repeat(201))).toThrow(RangeError);
  });
});

describe('resolveCanonicalKeys', () => {
  it('keeps every source key separate when there are no decisions', () => {
    const map = resolveCanonicalKeys([lc('two-sum'), tuf('two-sum')], []);
    expect(map.get(lc('two-sum'))).toBe('lc:two-sum');
    expect(map.get(tuf('two-sum'))).toBe('tuf:two-sum');
  });

  it('merges keys the user marked SAME (transitively)', () => {
    const keys = [lc('a'), tuf('a'), tuf('a-alt')];
    const map = resolveCanonicalKeys(keys, [
      decision('lc:a', 'tuf:a', 'SAME'),
      decision('tuf:a', 'tuf:a-alt', 'SAME'),
    ]);
    expect(new Set(keys.map((k) => map.get(k)))).toEqual(new Set(['lc:a']));
  });

  it('merges regardless of decision order or key order', () => {
    const keys = [tuf('z'), lc('m'), tuf('b')];
    const map = resolveCanonicalKeys(keys, [
      decision('tuf:z', 'lc:m', 'SAME'),
      decision('tuf:b', 'tuf:z', 'SAME'),
    ]);
    expect(new Set(keys.map((k) => map.get(k)))).toEqual(new Set(['lc:m']));
  });

  it('includes keys that only appear in decisions', () => {
    const map = resolveCanonicalKeys([], [decision('lc:x', 'tuf:x', 'DIFFERENT')]);
    expect(map.get(lc('x'))).toBe('lc:x');
    expect(map.get(tuf('x'))).toBe('tuf:x');
  });

  it('uses the latest decision for a pair', () => {
    const map = resolveCanonicalKeys(
      [lc('a'), tuf('a')],
      [decision('lc:a', 'tuf:a', 'SAME', 1), decision('tuf:a', 'lc:a', 'DIFFERENT', 2)],
    );
    expect(map.get(tuf('a'))).toBe('tuf:a');
  });
});

describe('suggestDuplicates', () => {
  it('normalizes titles', () => {
    expect(normalizeTitle('  Two-Sum!! ')).toBe('two sum');
  });

  it('suggests cross-platform problems with the same normalized title', () => {
    const s = suggestDuplicates(
      [
        { sourceKey: lc('two-sum'), title: 'Two Sum' },
        { sourceKey: tuf('two-sum-problem'), title: 'two sum' },
      ],
      [],
    );
    expect(s).toEqual([{ a: 'lc:two-sum', b: 'tuf:two-sum-problem' }]);
  });

  it('never suggests similar-but-different titles (Subsets vs Subsets II)', () => {
    const s = suggestDuplicates(
      [
        { sourceKey: lc('subsets'), title: 'Subsets' },
        { sourceKey: tuf('subsets-ii'), title: 'Subsets II' },
      ],
      [],
    );
    expect(s).toEqual([]);
  });

  it('orders each suggested pair by key', () => {
    expect(
      suggestDuplicates(
        [
          { sourceKey: tuf('two-sum'), title: 'Two Sum' },
          { sourceKey: lc('two-sum'), title: 'Two Sum' },
        ],
        [],
      ),
    ).toEqual([{ a: 'lc:two-sum', b: 'tuf:two-sum' }]);
  });

  it('does not suggest same-platform pairs or already-decided pairs', () => {
    expect(
      suggestDuplicates(
        [
          { sourceKey: lc('a'), title: 'Same' },
          { sourceKey: lc('b'), title: 'Same' },
        ],
        [],
      ),
    ).toEqual([]);
    expect(
      suggestDuplicates(
        [
          { sourceKey: lc('a'), title: 'Same' },
          { sourceKey: tuf('a'), title: 'Same' },
        ],
        [decision('tuf:a', 'lc:a', 'DIFFERENT')],
      ),
    ).toEqual([]);
  });
});
