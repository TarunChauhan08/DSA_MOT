import { describe, expect, it } from 'vitest';
import {
  decideMapping,
  finalizeDueDays,
  recordCompletion,
  startChallenge,
  type Deps,
} from '../../src/application/useCases';
import { makeSourceKey } from '../../src/domain/identity/identity';
import { config, ist, makeDeps, type FakeClock } from './helpers';

type TestDeps = Deps & { clock: FakeClock };

async function manual(deps: TestDeps, slug: string, platform: 'leetcode' | 'tuf' = 'leetcode') {
  const r = await recordCompletion(deps, { evidence: 'USER_MANUAL', platform, slug, title: slug });
  expect(r.status).toBe('recorded');
}

function lcEvent(submissionId: string, slug: string, istLocal: string) {
  return {
    evidence: 'LC_RECENT_AC',
    submissionId,
    slug,
    title: slug,
    sourceTimestampMs: ist(istLocal),
  };
}

/** Records a LeetCode accept and fails the test if it was rejected as invalid. */
async function lcAccepted(deps: TestDeps, submissionId: string, slug: string, istLocal: string) {
  const r = await recordCompletion(deps, lcEvent(submissionId, slug, istLocal));
  expect(r.status, JSON.stringify(r)).not.toBe('invalid');
  return r;
}

/** Solves `n` distinct manual problems on the given IST date. */
async function solveOn(deps: TestDeps, date: string, n: number) {
  deps.clock.at(`${date}T12:00`);
  for (let i = 0; i < n; i += 1) await manual(deps, `p-${date}-${String(i)}`);
}

async function started(deps: TestDeps, overrides = {}) {
  const r = await startChallenge(deps, config(overrides));
  if (!r.ok) throw new Error(`start failed: ${r.reason}`);
  return r.challenge;
}

async function totalPenalty(deps: TestDeps, challengeId: string) {
  const days = await deps.db.challengeDays.where('challengeId').equals(challengeId).toArray();
  return days.reduce((t, d) => t + d.penaltyPaise, 0);
}

describe('startChallenge', () => {
  it('starts today (day 1 = creation day) and freezes the config', async () => {
    const deps = makeDeps('2026-11-16T21:30');
    const c = await started(deps);
    expect(c).toMatchObject({ startDay: '2026-11-16', endDay: '2026-11-22', status: 'ACTIVE' });
    expect(await deps.db.auditEvents.where('type').equals('CHALLENGE_STARTED').count()).toBe(1);
  });

  it('uses the Kolkata date even late at night UTC', async () => {
    const deps = makeDeps('2026-11-17T00:10'); // 18:40Z on the 16th
    expect((await started(deps)).startDay).toBe('2026-11-17');
  });

  it('rejects a second active challenge', async () => {
    const deps = makeDeps();
    const first = await started(deps);
    expect(await startChallenge(deps, config())).toEqual({
      ok: false,
      reason: 'ACTIVE_CHALLENGE_EXISTS',
      activeId: first.id,
    });
  });

  it('rejects invalid configuration without writing anything', async () => {
    const deps = makeDeps();
    const r = await startChallenge(deps, config({ dailyTarget: 0 }));
    expect(r).toMatchObject({ ok: false, reason: 'INVALID_CONFIG' });
    expect(await deps.db.challenges.count()).toBe(0);
  });

  it('allows a new challenge once the previous one has ended', async () => {
    const deps = makeDeps('2026-11-16T10:00');
    await started(deps);
    deps.clock.at('2026-11-23T09:00');
    const next = await startChallenge(deps, config({ planDays: 15 }));
    expect(next.ok).toBe(true);
    const statuses = (await deps.db.challenges.toArray()).map((c) => c.status).sort();
    expect(statuses).toEqual(['ACTIVE', 'FAILED']);
  });
});

describe('full 7-day challenge (worked example)', () => {
  it('finalizes ₹85 and FAILED, with one ledger row per day', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    const c = await started(deps);
    const plan = [4, 3, 0, 0, 2, 0, 4];
    for (const [i, n] of plan.entries()) await solveOn(deps, `2026-11-${String(16 + i)}`, n);

    deps.clock.at('2026-11-23T00:01');
    await finalizeDueDays(deps);

    const days = await deps.db.challengeDays.where('challengeId').equals(c.id).sortBy('dayIndex');
    expect(days.map((d) => [d.solved, d.outcome, d.penaltyPaise])).toEqual([
      [4, 'SUCCESS', 0],
      [3, 'PARTIAL_PENALIZED', 500],
      [0, 'ZERO_GRACE', 0],
      [0, 'ZERO_GRACE', 0],
      [2, 'PARTIAL_PENALIZED', 2000],
      [0, 'ZERO_PENALIZED', 6000],
      [4, 'SUCCESS', 0],
    ]);
    expect(await totalPenalty(deps, c.id)).toBe(8500);
    expect((await deps.db.challenges.get(c.id))?.status).toBe('FAILED');
    expect(await deps.db.penaltyRecords.count()).toBe(7);
    expect(await deps.db.auditEvents.where('type').equals('CHALLENGE_COMPLETED').count()).toBe(1);
  });

  it('passes with 5 successful days', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    const c = await started(deps);
    for (const [i, n] of [4, 4, 0, 4, 0, 4, 4].entries()) {
      await solveOn(deps, `2026-11-${String(16 + i)}`, n);
    }
    deps.clock.at('2026-11-23T00:01');
    await finalizeDueDays(deps);
    expect((await deps.db.challenges.get(c.id))?.status).toBe('PASSED');
    expect(await totalPenalty(deps, c.id)).toBe(0);
  });
});

describe('catch-up finalization', () => {
  it('is idempotent: running it again writes nothing', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    await started(deps);
    await solveOn(deps, '2026-11-16', 3);
    deps.clock.at('2026-11-18T08:00');
    const first = await finalizeDueDays(deps);
    expect(first.finalized).toBe(2);

    const ledger = await deps.db.penaltyRecords.count();
    const audit = await deps.db.auditEvents.count();
    expect(await finalizeDueDays(deps)).toEqual({ finalized: 0, revised: 0, completed: 0 });
    expect(await deps.db.penaltyRecords.count()).toBe(ledger);
    expect(await deps.db.auditEvents.count()).toBe(audit);
  });

  it('catches up every missed day after Chrome was closed for days', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    const c = await started(deps);
    deps.clock.at('2026-11-20T07:00'); // first run after 4 closed days
    expect((await finalizeDueDays(deps)).finalized).toBe(4);
    const outcomes = (
      await deps.db.challengeDays.where('challengeId').equals(c.id).sortBy('dayIndex')
    ).map((d) => d.outcome);
    expect(outcomes).toEqual(['ZERO_GRACE', 'ZERO_GRACE', 'ZERO_PENALIZED', 'ZERO_PENALIZED']);
  });

  it('never finalizes today before midnight', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    await started(deps);
    deps.clock.at('2026-11-16T23:59');
    expect((await finalizeDueDays(deps)).finalized).toBe(0);
    deps.clock.at('2026-11-17T00:00');
    expect((await finalizeDueDays(deps)).finalized).toBe(1);
  });
});

describe('late-arriving data', () => {
  it('revises day 2 and downstream days deterministically, with audit and no double charge', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    const c = await started(deps);
    for (const [i, n] of [4, 3, 0, 0, 2, 0, 4].entries()) {
      await solveOn(deps, `2026-11-${String(16 + i)}`, n);
    }
    deps.clock.at('2026-11-23T00:01');
    await finalizeDueDays(deps);
    expect(await totalPenalty(deps, c.id)).toBe(8500);

    // A LeetCode accept from 17 Nov 23:50 IST is only discovered now.
    const r = await lcAccepted(deps, '9001', 'two-sum', '2026-11-17T23:50');
    expect(r.status).toBe('recorded');
    if (r.status === 'recorded') expect(r.recompute.revised).toBe(3); // days 2, 5, 6

    expect(await totalPenalty(deps, c.id)).toBe(5000);
    const day2 = await deps.db.challengeDays.get([c.id, '2026-11-17']);
    expect(day2).toMatchObject({ outcome: 'SUCCESS', revision: 2 });
    expect(await deps.db.penaltyRecords.filter((p) => p.reason === 'REVISED').count()).toBe(3);
    expect(await deps.db.auditEvents.where('type').equals('DAY_REVISED').count()).toBe(3);
  });

  it('flips a FAILED challenge to PASSED and records the outcome revision', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    const c = await started(deps);
    for (const [i, n] of [4, 4, 4, 4, 3, 0, 0].entries()) {
      await solveOn(deps, `2026-11-${String(16 + i)}`, n);
    }
    deps.clock.at('2026-11-23T00:01');
    await finalizeDueDays(deps);
    expect((await deps.db.challenges.get(c.id))?.status).toBe('FAILED');

    await lcAccepted(deps, '42', 'late-one', '2026-11-20T20:00');
    expect((await deps.db.challenges.get(c.id))?.status).toBe('PASSED');
    expect(
      await deps.db.auditEvents.where('type').equals('CHALLENGE_OUTCOME_REVISED').count(),
    ).toBe(1);
  });
});

describe('counting through the database', () => {
  async function dayOne(deps: TestDeps, challengeId: string) {
    deps.clock.at('2026-11-17T00:05');
    await finalizeDueDays(deps);
    return deps.db.challengeDays.get([challengeId, '2026-11-16']);
  }

  it('the same LeetCode submission is ingested once', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    await started(deps);
    expect((await lcAccepted(deps, '1', 'two-sum', '2026-11-16T08:00')).status).toBe('recorded');
    expect((await lcAccepted(deps, '1', 'two-sum', '2026-11-16T08:00')).status).toBe('duplicate');
    expect(await deps.db.completions.count()).toBe(1);
  });

  it('two accepts of the same problem on one day count once; re-solving on a later day counts again', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    const c = await started(deps);
    await lcAccepted(deps, '1', 'two-sum', '2026-11-16T08:00');
    await lcAccepted(deps, '2', 'two-sum', '2026-11-16T09:00');
    deps.clock.at('2026-11-17T10:00');
    await lcAccepted(deps, '3', 'two-sum', '2026-11-17T09:00');
    deps.clock.at('2026-11-18T00:05');
    await finalizeDueDays(deps);
    expect((await deps.db.challengeDays.get([c.id, '2026-11-16']))?.solved).toBe(1);
    expect((await deps.db.challengeDays.get([c.id, '2026-11-17']))?.solved).toBe(1);
  });

  it('a manual entry is upgraded (not double counted) when LeetCode verifies the same problem', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    const c = await started(deps);
    await manual(deps, 'two-sum');
    await lcAccepted(deps, '7', 'two-sum', '2026-11-16T08:30');
    expect((await dayOne(deps, c.id))?.solved).toBe(1);
  });

  it('a Striver sheet tick counts once per day', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    const c = await started(deps);
    const tick = {
      evidence: 'TUF_SHEET_CHECKBOX',
      slug: 'selection-sort',
      title: 'Selection Sort',
    };
    expect((await recordCompletion(deps, tick)).status).toBe('recorded');
    deps.clock.at('2026-11-16T15:00');
    expect((await recordCompletion(deps, tick)).status).toBe('duplicate');
    expect((await dayOne(deps, c.id))?.solved).toBe(1);
  });

  it('manual and sheet entries do not count when manual counting is off', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    const c = await started(deps, { countManual: false });
    await manual(deps, 'a');
    await recordCompletion(deps, { evidence: 'TUF_SHEET_CHECKBOX', slug: 'b', title: 'B' });
    await lcAccepted(deps, '1', 'c', '2026-11-16T08:30');
    expect((await dayOne(deps, c.id))?.solved).toBe(1);
  });

  it('completions outside the challenge window do not count toward it', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    const c = await started(deps);
    await lcAccepted(deps, '1', 'before', '2026-11-15T23:59');
    expect((await dayOne(deps, c.id))?.solved).toBe(0);
  });

  it('a cross-platform "same problem" decision merges counts and revises the day', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    const c = await started(deps);
    await lcAccepted(deps, '1', 'two-sum', '2026-11-16T08:00');
    await manual(deps, 'two-sum-problem', 'tuf');
    expect((await dayOne(deps, c.id))?.solved).toBe(2);

    const report = await decideMapping(
      deps,
      makeSourceKey('leetcode', 'two-sum'),
      makeSourceKey('tuf', 'two-sum-problem'),
      'SAME',
    );
    expect(report.revised).toBe(1);
    expect((await deps.db.challengeDays.get([c.id, '2026-11-16']))?.solved).toBe(1);
  });
});

describe('input validation at the boundary', () => {
  it.each([
    [{ evidence: 'LC_RECENT_AC', submissionId: 'x', slug: 'a', title: 'A', sourceTimestampMs: 0 }],
    [{ evidence: 'USER_MANUAL', platform: 'leetcode', slug: '<img onerror>', title: 'A' }],
    [{ evidence: 'USER_MANUAL', platform: 'codeforces', slug: 'a', title: 'A' }],
    [{ evidence: 'USER_MANUAL', platform: 'leetcode', slug: 'a', title: '' }],
    [{ evidence: 'WALLET_TRANSFER' }],
    [null],
  ])('rejects %j', async (raw) => {
    const deps = makeDeps();
    expect((await recordCompletion(deps, raw)).status).toBe('invalid');
    expect(await deps.db.completions.count()).toBe(0);
  });

  it('rejects platform timestamps from the future', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    const r = await recordCompletion(deps, lcEvent('1', 'a', '2026-11-16T10:00'));
    expect(r).toEqual({ status: 'invalid', issues: ['sourceTimestampMs: in the future'] });
  });

  it('builds problem URLs from the slug, never from page data', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    await lcAccepted(deps, '1', 'two-sum', '2026-11-16T08:00');
    expect((await deps.db.completions.get('lc-ac:1'))?.url).toBe(
      'https://leetcode.com/problems/two-sum/',
    );
  });
});
