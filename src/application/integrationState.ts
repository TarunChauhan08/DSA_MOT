import { z } from 'zod';
import type { DsaDatabase } from '../persistence/db';

/** Integration settings and health live in IndexedDB `meta` (validated on read). */
export const META_KEYS = {
  leetcodeUsername: 'leetcode.username',
  leetcodeHealth: 'leetcode.health',
  leetcodeStats: 'leetcode.stats',
  tufHealth: 'tuf.health',
} as const;

export const HealthSchema = z.object({
  lastAttemptAtMs: z.number().nullable(),
  lastSuccessAtMs: z.number().nullable(),
  lastError: z.string().nullable(),
  consecutiveFailures: z.number().int().nonnegative(),
  lastNewSolveAtMs: z.number().nullable(),
});
export type Health = z.infer<typeof HealthSchema>;

export const EMPTY_HEALTH: Health = {
  lastAttemptAtMs: null,
  lastSuccessAtMs: null,
  lastError: null,
  consecutiveFailures: 0,
  lastNewSolveAtMs: null,
};

export const StatsCacheSchema = z.object({
  fetchedAtMs: z.number(),
  all: z.number().int().nonnegative(),
  easy: z.number().int().nonnegative(),
  medium: z.number().int().nonnegative(),
  hard: z.number().int().nonnegative(),
});
export type StatsCache = z.infer<typeof StatsCacheSchema>;

const UsernameSchema = z.string().min(1).max(40);

async function readMeta<T>(db: DsaDatabase, key: string, schema: z.ZodType<T>): Promise<T | null> {
  const value = (await db.meta.get(key))?.value;
  if (value === undefined) return null;
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    console.warn(`[dsa] ignoring invalid stored ${key}`, parsed.error.issues);
    return null;
  }
  return parsed.data;
}

export const readLeetCodeUsername = (db: DsaDatabase) =>
  readMeta(db, META_KEYS.leetcodeUsername, UsernameSchema);
export const readHealth = async (db: DsaDatabase, key: string) =>
  (await readMeta(db, key, HealthSchema)) ?? EMPTY_HEALTH;
export const readStats = (db: DsaDatabase) =>
  readMeta(db, META_KEYS.leetcodeStats, StatsCacheSchema);
