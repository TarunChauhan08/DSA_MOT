import { describe, expect, it, vi } from 'vitest';
import {
  fetchRecentAccepted,
  fetchSolvedStats,
  LEETCODE_GRAPHQL_URL,
  parseRecentAccepted,
  parseSolvedStats,
  type FetchFn,
} from '../../../src/integrations/leetcode/client';

const bodyOf = (init: RequestInit | undefined): string =>
  typeof init?.body === 'string' ? init.body : '';

// Shape captured from the live endpoint on 2026-11-16 (owner's public profile).
const RECENT = {
  data: {
    matchedUser: { username: 'tarunchauhan199908' },
    recentAcSubmissionList: [
      {
        id: '1903120000',
        title: 'Valid Palindrome',
        titleSlug: 'valid-palindrome',
        timestamp: '1769973233',
      },
    ],
  },
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('parseRecentAccepted', () => {
  it('converts the live response shape (string seconds → ms)', () => {
    expect(parseRecentAccepted(RECENT)).toEqual({
      ok: true,
      value: [
        {
          submissionId: '1903120000',
          slug: 'valid-palindrome',
          title: 'Valid Palindrome',
          timestampMs: 1_769_973_233_000,
        },
      ],
    });
  });

  it('reports an unknown username', () => {
    expect(
      parseRecentAccepted({ data: { matchedUser: null, recentAcSubmissionList: null } }),
    ).toEqual({
      ok: false,
      error: { kind: 'USER_NOT_FOUND' },
    });
    expect(
      parseRecentAccepted({ data: null, errors: [{ message: 'That user does not exist.' }] }),
    ).toMatchObject({
      ok: false,
      error: { kind: 'USER_NOT_FOUND' },
    });
  });

  it.each([
    [{}],
    [
      {
        data: {
          matchedUser: { username: 'x' },
          recentAcSubmissionList: [{ id: 'abc', title: 'T', titleSlug: 't', timestamp: '1' }],
        },
      },
    ],
    [
      {
        data: {
          matchedUser: { username: 'x' },
          recentAcSubmissionList: [{ id: '1', title: '', titleSlug: 't', timestamp: '1' }],
        },
      },
    ],
    ['<html>'],
  ])('rejects unexpected data %j', (json) => {
    expect(parseRecentAccepted(json)).toMatchObject({ ok: false, error: { kind: 'BAD_RESPONSE' } });
  });

  it('treats a missing list as no recent solves', () => {
    expect(
      parseRecentAccepted({
        data: { matchedUser: { username: 'x' }, recentAcSubmissionList: null },
      }),
    ).toEqual({ ok: true, value: [] });
  });
});

describe('parseSolvedStats', () => {
  it('reads the difficulty breakdown', () => {
    const json = {
      data: {
        matchedUser: {
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
    expect(parseSolvedStats(json)).toEqual({
      ok: true,
      value: { all: 57, easy: 22, medium: 34, hard: 1 },
    });
  });
});

describe('fetch wrappers', () => {
  it('posts to the public GraphQL endpoint without credentials', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(jsonResponse(RECENT));
    await fetchRecentAccepted(fetchFn, 'tarunchauhan199908');
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe(LEETCODE_GRAPHQL_URL);
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit' });
    expect(JSON.parse(bodyOf(init))).toMatchObject({
      variables: { username: 'tarunchauhan199908' },
    });
    expect(init?.headers).not.toHaveProperty('cookie');
  });

  it.each([
    [403, { kind: 'HTTP', status: 403 }],
    [429, { kind: 'HTTP', status: 429 }],
  ])('maps HTTP %i', async (status, error) => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(jsonResponse({}, status));
    expect(await fetchSolvedStats(fetchFn, 'x')).toEqual({ ok: false, error });
  });

  it('maps network failures and invalid JSON', async () => {
    expect(
      await fetchRecentAccepted(vi.fn<FetchFn>().mockRejectedValue(new TypeError('offline')), 'x'),
    ).toEqual({
      ok: false,
      error: { kind: 'NETWORK', message: 'offline' },
    });
    const html = vi.fn<FetchFn>().mockResolvedValue(new Response('<html>', { status: 200 }));
    expect(await fetchRecentAccepted(html, 'x')).toMatchObject({
      ok: false,
      error: { kind: 'BAD_RESPONSE' },
    });
  });
});
