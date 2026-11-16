import { describe, expect, it, vi } from 'vitest';
import { META_KEYS, readHealth, readStats } from '../../src/application/integrationState';
import {
  connectLeetCode,
  disconnectLeetCode,
  ON_DEMAND_DEBOUNCE_MS,
  syncLeetCode,
  SYNC_INTERVAL_MS,
} from '../../src/application/leetcodeSync';
import { finalizeDueDays, startChallenge } from '../../src/application/useCases';
import type { FetchFn } from '../../src/integrations/leetcode/client';
import { config, ist, makeDeps } from './helpers';

const bodyOf = (init: RequestInit | undefined): string =>
  typeof init?.body === 'string' ? init.body : '';

interface FakeLeetCode {
  fetchFn: ReturnType<typeof vi.fn<FetchFn>>;
  solves: { id: string; slug: string; title: string; at: number }[];
  userExists: boolean;
  fail: number | null;
}

function fakeLeetCode(): FakeLeetCode {
  const state: FakeLeetCode = {
    solves: [],
    userExists: true,
    fail: null,
    fetchFn: vi.fn<FetchFn>(),
  };
  state.fetchFn.mockImplementation((_url, init) => {
    if (state.fail !== null) return Promise.resolve(new Response('', { status: state.fail }));
    const body = JSON.parse(bodyOf(init)) as { query: string };
    const user = state.userExists ? { username: 'tarun' } : null;
    const json = body.query.includes('recentAcSubmissionList')
      ? {
          data: {
            matchedUser: user,
            recentAcSubmissionList: state.userExists
              ? state.solves
                  .slice(-10)
                  .reverse()
                  .map((s) => ({
                    id: s.id,
                    title: s.title,
                    titleSlug: s.slug,
                    timestamp: String(Math.floor(s.at / 1000)),
                  }))
              : null,
          },
        }
      : {
          data: {
            matchedUser: user && {
              submitStatsGlobal: {
                acSubmissionNum: [
                  { difficulty: 'All', count: 57 },
                  { difficulty: 'Easy', count: 22 },
                  { difficulty: 'Medium', count: 34 },
                  { difficulty: 'Hard', count: 1 },
                ],
              },
            },
          },
        };
    return Promise.resolve(new Response(JSON.stringify(json), { status: 200 }));
  });
  return state;
}

const recentCalls = (lc: FakeLeetCode) =>
  lc.fetchFn.mock.calls.filter(([, init]) => bodyOf(init).includes('recentAcSubmissionList'))
    .length;

describe('connectLeetCode', () => {
  it('verifies the username before saving it', async () => {
    const deps = makeDeps();
    const lc = fakeLeetCode();
    lc.userExists = false;
    expect(await connectLeetCode(deps, lc.fetchFn, 'nobody')).toEqual({
      ok: false,
      message: 'LeetCode has no user with that username.',
    });
    expect(await deps.db.meta.get(META_KEYS.leetcodeUsername)).toBeUndefined();
  });

  it('rejects malformed usernames without any request', async () => {
    const deps = makeDeps();
    const lc = fakeLeetCode();
    expect((await connectLeetCode(deps, lc.fetchFn, 'bad name!')).ok).toBe(false);
    expect(lc.fetchFn).not.toHaveBeenCalled();
  });

  it('saves the username, imports recent solves and caches stats', async () => {
    const deps = makeDeps('2026-11-16T20:00');
    const lc = fakeLeetCode();
    lc.solves.push({ id: '1', slug: 'two-sum', title: 'Two Sum', at: ist('2026-11-16T19:00') });
    expect(await connectLeetCode(deps, lc.fetchFn, ' tarun ')).toEqual({ ok: true, newSolves: 1 });
    expect((await deps.db.meta.get(META_KEYS.leetcodeUsername))?.value).toBe('tarun');
    expect(await deps.db.completions.get('lc-ac:1')).toMatchObject({
      evidence: 'LC_RECENT_AC',
      sourceKey: 'lc:two-sum',
    });
    expect(await readStats(deps.db)).toMatchObject({ all: 57, easy: 22, medium: 34, hard: 1 });
    expect(await readHealth(deps.db, META_KEYS.leetcodeHealth)).toMatchObject({
      consecutiveFailures: 0,
      lastError: null,
    });
  });
});

describe('syncLeetCode', () => {
  async function connected(at = '2026-11-16T09:00') {
    const deps = makeDeps(at);
    const lc = fakeLeetCode();
    await connectLeetCode(deps, lc.fetchFn, 'tarun');
    lc.fetchFn.mockClear();
    return { deps, lc };
  }

  it('does nothing until a username is connected', async () => {
    const deps = makeDeps();
    const lc = fakeLeetCode();
    expect(await syncLeetCode(deps, lc.fetchFn, 'schedule')).toEqual({ status: 'not-connected' });
    expect(lc.fetchFn).not.toHaveBeenCalled();
  });

  it('checks at most every 30 minutes on schedule', async () => {
    const { deps, lc } = await connected();
    deps.clock.at('2026-11-16T09:29');
    expect(await syncLeetCode(deps, lc.fetchFn, 'schedule')).toEqual({ status: 'skipped' });
    deps.clock.at('2026-11-16T09:30');
    expect((await syncLeetCode(deps, lc.fetchFn, 'schedule')).status).toBe('synced');
    expect(recentCalls(lc)).toBe(1);
  });

  it('debounces on-demand checks to 2 minutes', async () => {
    const { deps, lc } = await connected();
    deps.clock.at('2026-11-16T09:01');
    expect((await syncLeetCode(deps, lc.fetchFn, 'on-demand')).status).toBe('skipped');
    deps.clock.at('2026-11-16T09:02');
    expect((await syncLeetCode(deps, lc.fetchFn, 'on-demand')).status).toBe('synced');
    expect(ON_DEMAND_DEBOUNCE_MS).toBe(120_000);
    expect(SYNC_INTERVAL_MS).toBe(1_800_000);
  });

  it('is idempotent: the same submissions are never counted twice', async () => {
    const { deps, lc } = await connected();
    lc.solves.push({ id: '9', slug: 'lru-cache', title: 'LRU Cache', at: ist('2026-11-16T09:10') });
    deps.clock.at('2026-11-16T09:40');
    expect(await syncLeetCode(deps, lc.fetchFn, 'schedule')).toEqual({
      status: 'synced',
      newSolves: 1,
    });
    deps.clock.at('2026-11-16T10:20');
    expect(await syncLeetCode(deps, lc.fetchFn, 'schedule')).toEqual({
      status: 'synced',
      newSolves: 0,
    });
    expect(await deps.db.completions.count()).toBe(1);
  });

  it('counts toward the challenge and attributes by LeetCode timestamp', async () => {
    const { deps, lc } = await connected('2026-11-16T09:00');
    await startChallenge(deps, config({ dailyTarget: 1 }));
    // Solved at 23:50 on day 1, only fetched after midnight.
    lc.solves.push({ id: '5', slug: 'two-sum', title: 'Two Sum', at: ist('2026-11-16T23:50') });
    deps.clock.at('2026-11-17T08:00');
    await finalizeDueDays(deps);
    expect((await deps.db.challengeDays.toArray())[0]).toMatchObject({ outcome: 'ZERO_GRACE' });
    await syncLeetCode(deps, lc.fetchFn, 'schedule');
    expect((await deps.db.challengeDays.toArray())[0]).toMatchObject({
      outcome: 'SUCCESS',
      revision: 2,
    });
  });

  it('backs off after failures and records a readable error', async () => {
    const { deps, lc } = await connected();
    lc.fail = 429;
    deps.clock.at('2026-11-16T09:30');
    expect(await syncLeetCode(deps, lc.fetchFn, 'schedule')).toEqual({
      status: 'error',
      error: { kind: 'HTTP', status: 429 },
    });
    expect(await readHealth(deps.db, META_KEYS.leetcodeHealth)).toMatchObject({
      consecutiveFailures: 1,
      lastError: 'LeetCode is rate-limiting requests. The extension will retry later.',
    });
    deps.clock.at('2026-11-16T10:00');
    await syncLeetCode(deps, lc.fetchFn, 'schedule'); // 2nd failure
    deps.clock.at('2026-11-16T10:59'); // backoff is now 60 min
    expect((await syncLeetCode(deps, lc.fetchFn, 'schedule')).status).toBe('skipped');
    expect((await syncLeetCode(deps, lc.fetchFn, 'on-demand')).status).toBe('skipped');
    lc.fail = null;
    deps.clock.at('2026-11-16T11:00');
    expect((await syncLeetCode(deps, lc.fetchFn, 'schedule')).status).toBe('synced');
    expect((await readHealth(deps.db, META_KEYS.leetcodeHealth)).consecutiveFailures).toBe(0);
  });

  it('refreshes the stats card at most every 6 hours', async () => {
    const { deps, lc } = await connected('2026-11-16T09:00');
    const statsCalls = () =>
      lc.fetchFn.mock.calls.filter(([, i]) => bodyOf(i).includes('submitStatsGlobal')).length;
    deps.clock.at('2026-11-16T14:59');
    await syncLeetCode(deps, lc.fetchFn, 'schedule');
    expect(statsCalls()).toBe(0);
    deps.clock.at('2026-11-16T15:30'); // next allowed check, ≥ 6 h after the 09:00 stats fetch
    await syncLeetCode(deps, lc.fetchFn, 'schedule');
    expect(statsCalls()).toBe(1);
  });

  it('disconnecting stops checks but keeps recorded history', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    const lc = fakeLeetCode();
    lc.solves.push({ id: '1', slug: 'two-sum', title: 'Two Sum', at: ist('2026-11-16T08:00') });
    await connectLeetCode(deps, lc.fetchFn, 'tarun');
    await disconnectLeetCode(deps);
    deps.clock.at('2026-11-16T12:00');
    expect(await syncLeetCode(deps, lc.fetchFn, 'schedule')).toEqual({ status: 'not-connected' });
    expect(await deps.db.completions.count()).toBe(1);
  });
});
