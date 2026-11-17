import { describe, expect, it } from 'vitest';
import { loadDashboard } from '../../src/application/queries';
import { finalizeDueDays, recordCompletions, startChallenge } from '../../src/application/useCases';
import { config, makeDeps } from './helpers';

describe('performance with a year of heavy use', () => {
  it('loads the dashboard in well under half a second', async () => {
    const deps = makeDeps('2025-11-17T09:00');
    // 365 days, 6 problems/day, a new 30-day challenge every month.
    for (let day = 0; day < 365; day += 1) {
      const date = new Date(Date.parse('2025-11-17T00:00:00Z') + day * 86_400_000)
        .toISOString()
        .slice(0, 10);
      deps.clock.at(`${date}T09:00`);
      if (day % 30 === 0) {
        await finalizeDueDays(deps);
        await startChallenge(deps, config({ planDays: 30, dailyTarget: 5 }));
      }
      await recordCompletions(
        deps,
        Array.from({ length: 6 }, (_, k) => ({
          evidence: 'USER_MANUAL',
          platform: 'leetcode',
          slug: `d${String(day)}-p${String(k)}`,
          title: 'P',
        })),
      );
    }
    expect(await deps.db.completions.count()).toBe(2190);

    const started = performance.now();
    const view = await loadDashboard(deps.db, deps.clock.now());
    const elapsed = performance.now() - started;
    expect(view.history).toHaveLength(365);
    expect(view.streak.longest).toBeGreaterThan(300);
    expect(elapsed).toBeLessThan(500);
  }, 120_000);
});
