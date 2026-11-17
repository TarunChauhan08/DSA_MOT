import { describe, expect, it } from 'vitest';
import { loadDashboard } from '../../src/application/queries';
import { recordCompletion, startChallenge } from '../../src/application/useCases';
import { todayCopy } from '../../src/ui/views/todayCopy';
import { config, makeDeps } from './helpers';

type D = ReturnType<typeof makeDeps>;
const solve = async (deps: D, n: number, prefix = 'p') => {
  for (let i = 0; i < n; i += 1) {
    await recordCompletion(deps, {
      evidence: 'USER_MANUAL',
      platform: 'leetcode',
      slug: `${prefix}${String(i)}`,
      title: 'P',
    });
  }
};
const copyAt = async (deps: D) => todayCopy(await loadDashboard(deps.db, deps.clock.now()));

describe('todayCopy', () => {
  it('no target yet', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    expect(await copyAt(deps)).toEqual({
      headline: 'No daily target yet.',
      detail: 'Start a challenge to set one.',
      streakWarning: null,
    });
  });

  it('zero while grace protects the day: protect the grace day', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    await startChallenge(deps, config());
    expect(await copyAt(deps)).toEqual({
      headline: 'Nothing solved yet.',
      detail: 'Ending at zero uses 1 of your 2 grace days. Hit all 4 to keep it.',
      streakWarning: null,
    });
  });

  it('partial: rupees at stake and the value of the next problem', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    await startChallenge(deps, config());
    await solve(deps, 1);
    expect(await copyAt(deps)).toMatchObject({
      headline: '3 more to go.',
      detail: '₹15 at stake. Each problem now saves ₹5.',
    });
  });

  it('streak at risk on the next day', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    await startChallenge(deps, config());
    await solve(deps, 4);
    expect((await copyAt(deps)).headline).toBe('Done for today.');
    deps.clock.at('2026-11-17T21:00');
    await solve(deps, 2, 'q');
    expect(await copyAt(deps)).toEqual({
      headline: '2 more to go.',
      detail: '₹10 at stake. Each problem now saves ₹5.',
      streakWarning: 'Your 1-day streak ends at midnight.',
    });
  });

  it('zero after grace is used up', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    await startChallenge(deps, config());
    deps.clock.at('2026-11-18T10:00'); // days 1 and 2 used both grace days
    expect(await copyAt(deps)).toMatchObject({
      headline: 'Nothing solved yet.',
      detail: '₹20 at stake. Your grace days are used up.',
    });
  });
});
