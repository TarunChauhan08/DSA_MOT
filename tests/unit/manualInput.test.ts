import { describe, expect, it } from 'vitest';
import { parseManualProblem } from '../../src/application/manualInput';

describe('parseManualProblem', () => {
  it.each([
    ['https://leetcode.com/problems/two-sum/', 'leetcode', 'two-sum', 'Two Sum'],
    [
      'https://leetcode.com/problems/two-sum/description/?envType=x',
      'leetcode',
      'two-sum',
      'Two Sum',
    ],
    ['leetcode.com/problems/3sum', 'leetcode', '3sum', '3sum'],
    ['https://www.leetcode.com/problems/lru-cache/', 'leetcode', 'lru-cache', 'Lru Cache'],
    [
      'https://takeuforward.org/practice/dsa/selection-sort',
      'tuf',
      'selection-sort',
      'Selection Sort',
    ],
  ] as const)('reads %s', (input, platform, slug, title) => {
    expect(parseManualProblem(input, 'tuf')).toEqual({ ok: true, platform, slug, title });
  });

  it('turns a typed problem name into a slug on the chosen platform', () => {
    expect(
      parseManualProblem('  Longest Substring Without Repeating Characters ', 'leetcode'),
    ).toEqual({
      ok: true,
      platform: 'leetcode',
      slug: 'longest-substring-without-repeating-characters',
      title: 'Longest Substring Without Repeating Characters',
    });
    expect(parseManualProblem("Kadane's Algorithm", 'tuf')).toMatchObject({
      slug: 'kadane-s-algorithm',
    });
  });

  it.each([
    ['', 'Enter a problem link or name.'],
    ['   ', 'Enter a problem link or name.'],
    ['!!!', 'Use letters or numbers in the problem name.'],
    [
      'https://codeforces.com/problemset/problem/1/A',
      'Only LeetCode and takeUforward links are supported.',
    ],
    ['https://leetcode.com/contest/weekly-1', 'That LeetCode link is not a problem page.'],
  ])('rejects %j', (input, message) => {
    expect(parseManualProblem(input, 'leetcode')).toEqual({ ok: false, message });
  });

  it('limits very long names', () => {
    const r = parseManualProblem('a'.repeat(500), 'leetcode');
    expect(r.ok && r.slug.length).toBe(200);
    expect(r.ok && r.title.length).toBe(200);
  });
});
