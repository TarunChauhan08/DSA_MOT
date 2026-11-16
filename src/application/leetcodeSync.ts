import {
  fetchRecentAccepted,
  fetchSolvedStats,
  LEETCODE_USERNAME_PATTERN,
  type FetchFn,
  type LeetCodeError,
} from '../integrations/leetcode/client';
import {
  META_KEYS,
  readHealth,
  readLeetCodeUsername,
  readStats,
  type Health,
} from './integrationState';
import { recordCompletions, type Deps } from './useCases';

/** ADR-0004: at most one scheduled check per 30 min; on-demand checks debounced to 2 min. */
export const SYNC_INTERVAL_MS = 30 * 60_000;
export const ON_DEMAND_DEBOUNCE_MS = 2 * 60_000;
export const STATS_INTERVAL_MS = 6 * 60 * 60_000;
export const MAX_BACKOFF_MS = 6 * 60 * 60_000;

export type SyncTrigger = 'schedule' | 'on-demand';

export type SyncOutcome =
  | { readonly status: 'not-connected' }
  | { readonly status: 'skipped' }
  | { readonly status: 'error'; readonly error: LeetCodeError }
  | { readonly status: 'synced'; readonly newSolves: number };

export function describeLeetCodeError(error: LeetCodeError): string {
  switch (error.kind) {
    case 'USER_NOT_FOUND':
      return 'LeetCode has no user with that username.';
    case 'HTTP':
      return error.status === 429
        ? 'LeetCode is rate-limiting requests. The extension will retry later.'
        : `LeetCode answered with HTTP ${String(error.status)}.`;
    case 'NETWORK':
      return 'Could not reach LeetCode. Check your connection.';
    case 'BAD_RESPONSE':
      return 'LeetCode returned data in an unexpected format.';
  }
}

function minimumGap(trigger: SyncTrigger, failures: number): number {
  const base = trigger === 'on-demand' ? ON_DEMAND_DEBOUNCE_MS : SYNC_INTERVAL_MS;
  if (failures === 0) return base;
  return Math.max(base, Math.min(SYNC_INTERVAL_MS * 2 ** (failures - 1), MAX_BACKOFF_MS));
}

async function writeHealth(deps: Deps, health: Health): Promise<void> {
  await deps.db.meta.put({ key: META_KEYS.leetcodeHealth, value: health });
}

async function runSync(
  deps: Deps,
  fetchFn: FetchFn,
  username: string,
  health: Health,
): Promise<SyncOutcome> {
  const now = deps.clock.now();
  await writeHealth(deps, { ...health, lastAttemptAtMs: now });

  const recent = await fetchRecentAccepted(fetchFn, username);
  if (!recent.ok) {
    await writeHealth(deps, {
      ...health,
      lastAttemptAtMs: now,
      lastError: describeLeetCodeError(recent.error),
      consecutiveFailures: health.consecutiveFailures + 1,
    });
    return { status: 'error', error: recent.error };
  }

  const batch = await recordCompletions(
    deps,
    recent.value.map((s) => ({
      evidence: 'LC_RECENT_AC',
      submissionId: s.submissionId,
      slug: s.slug,
      title: s.title,
      sourceTimestampMs: s.timestampMs,
    })),
  );

  const cached = await readStats(deps.db);
  if (cached === null || now - cached.fetchedAtMs >= STATS_INTERVAL_MS) {
    const stats = await fetchSolvedStats(fetchFn, username);
    if (stats.ok)
      await deps.db.meta.put({
        key: META_KEYS.leetcodeStats,
        value: { fetchedAtMs: now, ...stats.value },
      });
  }

  await writeHealth(deps, {
    lastAttemptAtMs: now,
    lastSuccessAtMs: now,
    lastError: null,
    consecutiveFailures: 0,
    lastNewSolveAtMs: batch.recorded.length > 0 ? now : health.lastNewSolveAtMs,
  });
  return { status: 'synced', newSolves: batch.recorded.length };
}

/** Pulls recent accepted LeetCode solves for the connected username, respecting throttles. */
export async function syncLeetCode(
  deps: Deps,
  fetchFn: FetchFn,
  trigger: SyncTrigger,
): Promise<SyncOutcome> {
  const username = await readLeetCodeUsername(deps.db);
  if (username === null) return { status: 'not-connected' };
  const health = await readHealth(deps.db, META_KEYS.leetcodeHealth);
  const now = deps.clock.now();
  if (
    health.lastAttemptAtMs !== null &&
    now - health.lastAttemptAtMs < minimumGap(trigger, health.consecutiveFailures)
  ) {
    return { status: 'skipped' };
  }
  return runSync(deps, fetchFn, username, health);
}

export type ConnectResult =
  | { readonly ok: true; readonly newSolves: number }
  | { readonly ok: false; readonly message: string };

/** Verifies the username against LeetCode before saving it. */
export async function connectLeetCode(
  deps: Deps,
  fetchFn: FetchFn,
  rawUsername: string,
): Promise<ConnectResult> {
  const username = rawUsername.trim();
  if (!LEETCODE_USERNAME_PATTERN.test(username)) {
    return { ok: false, message: 'Usernames contain only letters, numbers, "_" and "-".' };
  }
  const check = await fetchRecentAccepted(fetchFn, username);
  if (!check.ok) return { ok: false, message: describeLeetCodeError(check.error) };

  await deps.db.transaction('rw', deps.db.meta, async () => {
    await deps.db.meta.put({ key: META_KEYS.leetcodeUsername, value: username });
    await deps.db.meta.delete(META_KEYS.leetcodeHealth);
    await deps.db.meta.delete(META_KEYS.leetcodeStats);
  });
  const outcome = await runSync(
    deps,
    fetchFn,
    username,
    await readHealth(deps.db, META_KEYS.leetcodeHealth),
  );
  return outcome.status === 'synced'
    ? { ok: true, newSolves: outcome.newSolves }
    : { ok: true, newSolves: 0 };
}

/** Forgets the username and status. Already-recorded solves stay in history. */
export async function disconnectLeetCode(deps: Deps): Promise<void> {
  await deps.db.meta.bulkDelete([
    META_KEYS.leetcodeUsername,
    META_KEYS.leetcodeHealth,
    META_KEYS.leetcodeStats,
  ]);
}
