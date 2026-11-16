import { z } from 'zod';

/**
 * LeetCode public GraphQL access by username (ADR-0004 rev. 2/3). No cookies,
 * tokens or passwords: `credentials: "omit"`. Responses are untrusted → Zod.
 */
export const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql/';
const REQUEST_TIMEOUT_MS = 15_000;
/** LeetCode returns at most ~10 entries regardless of the limit (verified 2026-11-16). */
const RECENT_LIMIT = 20;
const MS_PER_SECOND = 1000;

export const LEETCODE_USERNAME_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export type LeetCodeError =
  | { readonly kind: 'USER_NOT_FOUND' }
  | { readonly kind: 'HTTP'; readonly status: number }
  | { readonly kind: 'NETWORK'; readonly message: string }
  | { readonly kind: 'BAD_RESPONSE'; readonly message: string };

export type LeetCodeResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: LeetCodeError };

export interface RecentAccepted {
  readonly submissionId: string;
  readonly slug: string;
  readonly title: string;
  readonly timestampMs: number;
}

export interface SolvedStats {
  readonly all: number;
  readonly easy: number;
  readonly medium: number;
  readonly hard: number;
}

const RecentResponse = z.object({
  data: z
    .object({
      matchedUser: z.object({ username: z.string() }).nullable(),
      recentAcSubmissionList: z
        .array(
          z.object({
            id: z.string().regex(/^\d{1,20}$/),
            title: z.string().min(1).max(300),
            titleSlug: z.string().min(1).max(200),
            timestamp: z.union([z.string().regex(/^\d{1,13}$/), z.number().int().nonnegative()]),
          }),
        )
        .nullable(),
    })
    .nullable(),
});

const StatsResponse = z.object({
  data: z
    .object({
      matchedUser: z
        .object({
          submitStatsGlobal: z.object({
            acSubmissionNum: z.array(
              z.object({ difficulty: z.string(), count: z.number().int().nonnegative() }),
            ),
          }),
        })
        .nullable(),
    })
    .nullable(),
});

const RECENT_QUERY = `query recentAc($username: String!, $limit: Int!) {
  matchedUser(username: $username) { username }
  recentAcSubmissionList(username: $username, limit: $limit) { id title titleSlug timestamp }
}`;

const STATS_QUERY = `query solved($username: String!) {
  matchedUser(username: $username) { submitStatsGlobal { acSubmissionNum { difficulty count } } }
}`;

async function post(
  fetchFn: FetchFn,
  query: string,
  variables: object,
): Promise<LeetCodeResult<unknown>> {
  let response: Response;
  try {
    response = await fetchFn(LEETCODE_GRAPHQL_URL, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error: unknown) {
    return {
      ok: false,
      error: { kind: 'NETWORK', message: error instanceof Error ? error.message : String(error) },
    };
  }
  if (!response.ok) return { ok: false, error: { kind: 'HTTP', status: response.status } };
  try {
    return { ok: true, value: (await response.json()) as unknown };
  } catch (error: unknown) {
    return {
      ok: false,
      error: {
        kind: 'BAD_RESPONSE',
        message: error instanceof Error ? error.message : 'Invalid JSON',
      },
    };
  }
}

export function parseRecentAccepted(json: unknown): LeetCodeResult<RecentAccepted[]> {
  const parsed = RecentResponse.safeParse(json);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        kind: 'BAD_RESPONSE',
        message: parsed.error.issues[0]?.message ?? 'Unexpected shape',
      },
    };
  const data = parsed.data.data;
  if (data?.matchedUser == null) return { ok: false, error: { kind: 'USER_NOT_FOUND' } };
  return {
    ok: true,
    value: (data.recentAcSubmissionList ?? []).map((s) => ({
      submissionId: s.id,
      slug: s.titleSlug,
      title: s.title,
      timestampMs: Number(s.timestamp) * MS_PER_SECOND,
    })),
  };
}

export function parseSolvedStats(json: unknown): LeetCodeResult<SolvedStats> {
  const parsed = StatsResponse.safeParse(json);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        kind: 'BAD_RESPONSE',
        message: parsed.error.issues[0]?.message ?? 'Unexpected shape',
      },
    };
  const user = parsed.data.data?.matchedUser;
  if (user == null) return { ok: false, error: { kind: 'USER_NOT_FOUND' } };
  const count = (d: string) =>
    user.submitStatsGlobal.acSubmissionNum.find((x) => x.difficulty === d)?.count ?? 0;
  return {
    ok: true,
    value: { all: count('All'), easy: count('Easy'), medium: count('Medium'), hard: count('Hard') },
  };
}

export async function fetchRecentAccepted(
  fetchFn: FetchFn,
  username: string,
): Promise<LeetCodeResult<RecentAccepted[]>> {
  const r = await post(fetchFn, RECENT_QUERY, { username, limit: RECENT_LIMIT });
  return r.ok ? parseRecentAccepted(r.value) : r;
}

export async function fetchSolvedStats(
  fetchFn: FetchFn,
  username: string,
): Promise<LeetCodeResult<SolvedStats>> {
  const r = await post(fetchFn, STATS_QUERY, { username });
  return r.ok ? parseSolvedStats(r.value) : r;
}
