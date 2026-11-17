import { describe, expect, it } from 'vitest';
import { loadDashboard } from '../../src/application/queries';
import {
  decideMapping,
  finalizeDueDays,
  recordCompletion,
  startChallenge,
} from '../../src/application/useCases';
import { makeSourceKey } from '../../src/domain/identity/identity';
import { config, ist, makeDeps } from './helpers';

type D = ReturnType<typeof makeDeps>;

async function manual(deps: D, slug: string) {
  const r = await recordCompletion(deps, {
    evidence: 'USER_MANUAL',
    platform: 'leetcode',
    slug,
    title: slug,
  });
  expect(r.status).toBe('recorded');
}

describe('loadDashboard', () => {
  it('first run: no challenge, no metrics', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    const view = await loadDashboard(deps.db, deps.clock.now());
    expect(view).toMatchObject({
      today: '2026-11-16',
      hasAnyChallenge: false,
      current: null,
      todaySolved: 0,
      todayTarget: null,
      challenges: [],
      lifetimePenaltyPaise: 0,
    });
    expect(view.streak.current).toBe(0);
  });

  it('day 1 of a 7-day challenge: progress, projected penalty and grace', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    await startChallenge(deps, config());
    await manual(deps, 'a');
    await manual(deps, 'b');
    await manual(deps, 'a'); // same problem twice → counts once

    const view = await loadDashboard(deps.db, deps.clock.now());
    expect(view.todaySolved).toBe(2);
    expect(view.todayTarget).toBe(4);
    expect(view.todayEntries.map((e) => e.status).sort()).toEqual([
      'COUNTED',
      'COUNTED',
      'DUPLICATE_EXCLUDED',
    ]);
    expect(view.current).toMatchObject({
      dayNumber: 1,
      planDays: 7,
      graceRemaining: 2,
      successDays: 0,
      requiredSuccessDays: 5,
      closedPenaltyPaise: 0,
      canStillPass: true,
    });
    // 2/4 on the first penalized day → ₹10 if the day ended now.
    expect(view.current?.projectedToday).toMatchObject({
      outcome: 'PARTIAL_PENALIZED',
      penaltyPaise: 1000,
    });
    expect(view.current?.days.map((d) => d.state)).toEqual([
      'today',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
  });

  it('shows correct closed days even before the service worker finalizes them', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    await startChallenge(deps, config());
    for (const s of ['a', 'b', 'c', 'd']) await manual(deps, s);
    deps.clock.at('2026-11-17T08:00'); // no finalizeDueDays call
    const view = await loadDashboard(deps.db, deps.clock.now());
    expect(view.current?.dayNumber).toBe(2);
    expect(view.current?.days[0]).toMatchObject({ state: 'closed', solved: 4, outcome: 'SUCCESS' });
    expect(view.current?.successDays).toBe(1);
    expect(view.streak.current).toBe(1);
    expect(view.todaySolved).toBe(0);
  });

  it('tracks totals, streak and history across a finished challenge', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    await startChallenge(deps, config());
    const plan = [4, 3, 0, 0, 2, 0, 4];
    for (const [i, n] of plan.entries()) {
      deps.clock.at(`2026-11-${String(16 + i)}T12:00`);
      for (let k = 0; k < n; k += 1) await manual(deps, `p${String(i)}-${String(k)}`);
    }
    deps.clock.at('2026-11-23T10:00');
    await finalizeDueDays(deps);

    const view = await loadDashboard(deps.db, deps.clock.now());
    expect(view.current).toBeNull();
    expect(view.challenges).toHaveLength(1);
    expect(view.challenges[0]).toMatchObject({
      status: 'FAILED',
      totalPenaltyPaise: 8500,
      successDays: 2,
    });
    expect(view.lifetimePenaltyPaise).toBe(8500);
    // Outside a challenge the last target (4) still applies to the streak.
    expect(view.todayTarget).toBe(4);
    expect(view.streak).toMatchObject({
      current: 1,
      longest: 1,
      successfulDays: 2,
      incompleteDays: 5,
    });
  });

  it('marks the challenge as unable to pass when too many days are lost', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    await startChallenge(deps, config());
    deps.clock.at('2026-11-19T09:00');
    const view = await loadDashboard(deps.db, deps.clock.now());
    expect(view.current).toMatchObject({ dayNumber: 4, successDays: 0, canStillPass: false });
  });

  it('labels a LeetCode-verified problem that was also entered manually', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    await startChallenge(deps, config());
    await manual(deps, 'two-sum');
    await recordCompletion(deps, {
      evidence: 'LC_RECENT_AC',
      submissionId: '5',
      slug: 'two-sum',
      title: 'Two Sum',
      sourceTimestampMs: ist('2026-11-16T08:30'),
    });
    const view = await loadDashboard(deps.db, deps.clock.now());
    expect(view.todaySolved).toBe(1);
    expect(view.todayEntries.map((e) => [e.evidence, e.status]).sort()).toEqual([
      ['LC_RECENT_AC', 'COUNTED'],
      ['USER_MANUAL', 'SUPERSEDED_BY_VERIFIED'],
    ]);
  });
});

describe('loadDashboard — integrations and duplicates', () => {
  it('reports LeetCode as not connected by default', async () => {
    const deps = makeDeps();
    const view = await loadDashboard(deps.db, deps.clock.now());
    expect(view.integrations.leetcode).toMatchObject({
      username: null,
      stats: null,
      health: { lastAttemptAtMs: null },
    });
  });

  it('suggests a same-title problem from the other platform until the user decides', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    await recordCompletion(deps, {
      evidence: 'USER_MANUAL',
      platform: 'leetcode',
      slug: 'two-sum',
      title: 'Two Sum',
    });
    await recordCompletion(deps, {
      evidence: 'TUF_SHEET_CHECKBOX',
      slug: 'two-sum-problem',
      title: 'Two Sum',
    });
    let view = await loadDashboard(deps.db, deps.clock.now());
    expect(view.duplicateSuggestions).toEqual([
      { a: 'lc:two-sum', b: 'tuf:two-sum-problem', titleA: 'Two Sum', titleB: 'Two Sum' },
    ]);
    expect(view.todaySolved).toBe(2);

    await decideMapping(
      deps,
      makeSourceKey('leetcode', 'two-sum'),
      makeSourceKey('tuf', 'two-sum-problem'),
      'SAME',
    );
    view = await loadDashboard(deps.db, deps.clock.now());
    expect(view.duplicateSuggestions).toEqual([]);
    expect(view.todaySolved).toBe(1);
  });
});

describe('loadDashboard — accountability analytics', () => {
  async function workedExample() {
    const deps = makeDeps('2026-11-16T09:00');
    await startChallenge(deps, config());
    for (const [i, n] of [4, 3, 0, 0, 2, 0, 4].entries()) {
      deps.clock.at(`2026-11-${String(16 + i)}T12:00`);
      for (let k = 0; k < n; k += 1) await manual(deps, `p${String(i)}-${String(k)}`);
    }
    return deps;
  }

  it('penalty stats, trend and persisted ledger after the worked example', async () => {
    const deps = await workedExample();
    deps.clock.at('2026-11-23T10:00');
    await finalizeDueDays(deps);
    const view = await loadDashboard(deps.db, deps.clock.now());
    expect(view.penalty).toEqual({
      totalPaise: 8500,
      highestPaise: 6000,
      evaluatedDays: 7,
      penalizedDays: 3,
      averagePerDayPaise: 1214, // 8500 / 7 = 1214.29
      averagePerPenalizedDayPaise: 2833,
    });
    expect(view.penaltyTrend.map((p) => p.penaltyPaise)).toEqual([0, 500, 0, 0, 2000, 6000, 0]);
    expect(view.ledger.map((l) => [l.day, l.penaltyPaise])).toEqual([
      ['2026-11-21', 6000],
      ['2026-11-20', 2000],
      ['2026-11-17', 500],
    ]);
    expect(view.rates.week).toEqual({ successDays: 2, eligibleDays: 7, percent: 29 });
  });

  it('shows ledger revisions caused by late data', async () => {
    const deps = await workedExample();
    deps.clock.at('2026-11-23T10:00');
    await finalizeDueDays(deps);
    await recordCompletion(deps, {
      evidence: 'LC_RECENT_AC',
      submissionId: '77',
      slug: 'late',
      title: 'Late',
      sourceTimestampMs: ist('2026-11-17T22:00'),
    });
    const view = await loadDashboard(deps.db, deps.clock.now());
    expect(view.ledger.find((l) => l.day === '2026-11-17')).toMatchObject({
      penaltyPaise: 0,
      previousPenaltyPaise: 500,
      revision: 2,
    });
    expect(view.penalty.totalPaise).toBe(5000);
  });

  it('time pressure and the value of one more problem', async () => {
    const deps = makeDeps('2026-11-16T21:30');
    await startChallenge(deps, config());
    await manual(deps, 'a');
    const view = await loadDashboard(deps.db, deps.clock.now());
    expect(view.msLeftToday).toBe(150 * 60_000);
    expect(view.urgency).toBe('heads-up');
    expect(view.savingForOneMorePaise).toBe(500);
    expect(view.settings.theme).toBe('dark');
  });
});
