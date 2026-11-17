import { z } from 'zod';
import { isValidTimeZone } from '../domain/calendar';
import { MAX_DAILY_TARGET, MAX_PENALTY_PAISE } from '../domain/challenge/config';
import { TEST_CLOCK_META_KEY } from '../platform/clock';
import type { DsaDatabase } from '../persistence/db';
import type {
  AuditEvent,
  ChallengeDayRecord,
  ChallengeRecord,
  CompletionRecord,
  MappingRecord,
  PenaltyRecord,
} from '../persistence/records';
import { LATEST_SCHEMA_VERSION } from '../persistence/schema';
import { recomputeAll } from './recompute';

export const BACKUP_FORMAT = 'dsa-discipline-backup';

const id = z.string().min(1).max(200);
const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ms = z.number().int().nonnegative();
const paiseAmount = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const sourceKey = z
  .string()
  .regex(/^(lc|tuf):[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(210);
const outcome = z.enum(['SUCCESS', 'PARTIAL_PENALIZED', 'ZERO_GRACE', 'ZERO_PENALIZED']);

const ChallengeSchema = z
  .object({
    id,
    config: z
      .object({
        planDays: z.union([z.literal(7), z.literal(15), z.literal(30)]),
        dailyTarget: z.number().int().min(1).max(MAX_DAILY_TARGET),
        startPenaltyPaise: z.number().int().min(0).max(MAX_PENALTY_PAISE),
        incrementPaise: z.number().int().min(0).max(MAX_PENALTY_PAISE),
        timeZone: z.string().refine(isValidTimeZone),
        countManual: z.boolean(),
      })
      .strict(),
    startDay: dayKey,
    endDay: dayKey,
    status: z.enum(['ACTIVE', 'PASSED', 'FAILED']),
    createdAtMs: ms,
    completedAtMs: ms.nullable(),
  })
  .strict();

const ChallengeDaySchema = z
  .object({
    challengeId: id,
    day: dayKey,
    dayIndex: z.number().int().min(0).max(29),
    solved: z.number().int().nonnegative(),
    countedCompletionIds: z.array(id),
    outcome,
    graceUsedAfter: z.number().int().nonnegative(),
    penalizedIndex: z.number().int().positive().nullable(),
    ratePaise: paiseAmount.nullable(),
    penaltyPaise: paiseAmount,
    inputsKey: z.string().max(100_000),
    revision: z.number().int().positive(),
    finalizedAtMs: ms,
  })
  .strict();

const PenaltyRecordSchema = z
  .object({
    id: z.number().int().positive().optional(),
    challengeId: id,
    day: dayKey,
    revision: z.number().int().positive(),
    ratePaise: paiseAmount.nullable(),
    penaltyPaise: paiseAmount,
    reason: z.enum(['FINALIZED', 'REVISED']),
    recordedAtMs: ms,
  })
  .strict();

const CompletionSchema = z
  .object({
    id,
    sourceKey,
    evidence: z.enum([
      'LC_RECENT_AC',
      'TUF_SUBMISSION_ACCEPTED',
      'TUF_SHEET_CHECKBOX',
      'USER_MANUAL',
    ]),
    sourceTimestampMs: ms,
    discoveredAtMs: ms,
    title: z.string().min(1).max(300),
    url: z
      .string()
      .regex(
        /^https:\/\/(leetcode\.com\/problems|takeuforward\.org\/practice\/dsa)\/[a-z0-9-]+\/?$/,
      ),
  })
  .strict();

const MappingSchema = z
  .object({
    id: z.string().max(430),
    a: sourceKey,
    b: sourceKey,
    decision: z.enum(['SAME', 'DIFFERENT']),
    decidedAtMs: ms,
  })
  .strict();

const AuditSchema = z
  .object({
    seq: z.number().int().positive().optional(),
    type: z.string().max(60),
    atMs: ms,
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();

const MetaSchema = z.object({ key: z.string().min(1).max(100), value: z.unknown() }).strict();
const NotificationLogSchema = z
  .object({ eventKey: z.string().min(1).max(200), sentAtMs: ms })
  .strict();

const DataSchema = z
  .object({
    challenges: z.array(ChallengeSchema),
    challengeDays: z.array(ChallengeDaySchema),
    penaltyRecords: z.array(PenaltyRecordSchema),
    completions: z.array(CompletionSchema),
    mappings: z.array(MappingSchema),
    auditEvents: z.array(AuditSchema),
    meta: z.array(MetaSchema),
    notificationLog: z.array(NotificationLogSchema),
  })
  .strict();

export type BackupData = z.infer<typeof DataSchema>;

const BackupSchema = z
  .object({
    format: z.literal(BACKUP_FORMAT),
    schemaVersion: z.number().int().min(1).max(LATEST_SCHEMA_VERSION),
    exportedAtMs: ms,
    appVersion: z.string().max(40),
    checksum: z.string().regex(/^[0-9a-f]{64}$/),
    data: DataSchema,
  })
  .strict();

export type Backup = z.infer<typeof BackupSchema>;

/** JSON with sorted object keys, so the checksum does not depend on key order. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const checksumOf = (schemaVersion: unknown, data: unknown) =>
  sha256Hex(canonicalJson({ schemaVersion, data }));

/** Test/support helper: re-signs an edited backup object. */
export async function recomputeChecksum<T extends { schemaVersion: unknown; data: unknown }>(
  backup: T,
): Promise<T & { checksum: string }> {
  return { ...backup, checksum: await checksumOf(backup.schemaVersion, backup.data) };
}

async function readAll(db: DsaDatabase) {
  return {
    challenges: await db.challenges.toArray(),
    challengeDays: await db.challengeDays.toArray(),
    penaltyRecords: await db.penaltyRecords.toArray(),
    completions: await db.completions.toArray(),
    mappings: await db.mappings.toArray(),
    auditEvents: await db.auditEvents.toArray(),
    // The e2e test clock is never part of user data.
    meta: (await db.meta.toArray()).filter((m) => m.key !== TEST_CLOCK_META_KEY),
    notificationLog: await db.notificationLog.toArray(),
  };
}

/**
 * Backup rows were validated by Zod (same shapes as the tables); this restores the
 * branded types (DayKey, Paise, SourceKey) that plain JSON cannot carry.
 */
function asStored<T>(rows: readonly unknown[]): T[] {
  return rows as T[];
}

export async function exportBackup(
  db: DsaDatabase,
  nowMs: number,
  appVersion: string,
): Promise<{ readonly json: string; readonly checksum: string }> {
  const data = await readAll(db);
  const checksum = await checksumOf(LATEST_SCHEMA_VERSION, data);
  const backup = {
    format: BACKUP_FORMAT,
    schemaVersion: LATEST_SCHEMA_VERSION,
    exportedAtMs: nowMs,
    appVersion,
    checksum,
    data,
  };
  return { json: JSON.stringify(backup), checksum };
}

export type ParsedBackup =
  { readonly ok: true; readonly backup: Backup } | { readonly ok: false; readonly reason: string };

/** Migrates older backup data in place to the current schema (append a step per version). */
function migrate(schemaVersion: number, data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  if (schemaVersion < 2) out.notificationLog ??= [];
  return out;
}

/** Validates an uploaded file: format, version, checksum, then every record (untrusted input). */
export async function parseBackup(text: string): Promise<ParsedBackup> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error: unknown) {
    if (error instanceof SyntaxError)
      return { ok: false, reason: 'Not a valid backup file (not JSON).' };
    throw error;
  }
  if (
    typeof raw !== 'object' ||
    raw === null ||
    (raw as { format?: unknown }).format !== BACKUP_FORMAT
  ) {
    return { ok: false, reason: 'This file is not a DSA Discipline backup.' };
  }
  const head = raw as { schemaVersion?: unknown; checksum?: unknown; data?: unknown };
  if (
    typeof head.schemaVersion !== 'number' ||
    !Number.isInteger(head.schemaVersion) ||
    head.schemaVersion < 1
  ) {
    return { ok: false, reason: 'The backup has no valid schema version.' };
  }
  if (head.schemaVersion > LATEST_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: 'This backup was made by a newer version. Update the extension first.',
    };
  }
  if ((await checksumOf(head.schemaVersion, head.data)) !== head.checksum) {
    return { ok: false, reason: 'The backup is damaged: its checksum does not match.' };
  }
  if (typeof head.data !== 'object' || head.data === null)
    return { ok: false, reason: 'The backup has no data.' };

  const migratedData = migrate(head.schemaVersion, head.data as Record<string, unknown>);
  const parsed = BackupSchema.safeParse({
    ...raw,
    schemaVersion: LATEST_SCHEMA_VERSION,
    data: migratedData,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      reason: `The backup contains invalid data (${issue?.path.join('.') ?? 'unknown'}).`,
    };
  }
  return {
    ok: true,
    backup: { ...parsed.data, checksum: await checksumOf(LATEST_SCHEMA_VERSION, parsed.data.data) },
  };
}

export type ImportResult =
  | { readonly ok: true; readonly completions: number; readonly challenges: number }
  | { readonly ok: false; readonly reason: 'DUPLICATE' };

/**
 * Replaces all data with the backup in one transaction (all or nothing), then re-derives
 * results. The UI saves a copy of the current data before calling this.
 */
export async function importBackup(
  db: DsaDatabase,
  backup: Backup,
  nowMs: number,
): Promise<ImportResult> {
  const current = await checksumOf(LATEST_SCHEMA_VERSION, await readAll(db));
  if (current === backup.checksum) return { ok: false, reason: 'DUPLICATE' };

  const d = backup.data;
  await db.transaction('rw', db.tables, async () => {
    const testClock = await db.meta.get(TEST_CLOCK_META_KEY);
    await Promise.all(db.tables.map((t) => t.clear()));
    await db.challenges.bulkAdd(asStored<ChallengeRecord>(d.challenges));
    await db.challengeDays.bulkAdd(asStored<ChallengeDayRecord>(d.challengeDays));
    await db.penaltyRecords.bulkAdd(asStored<PenaltyRecord>(d.penaltyRecords));
    await db.completions.bulkAdd(asStored<CompletionRecord>(d.completions));
    await db.mappings.bulkAdd(asStored<MappingRecord>(d.mappings));
    await db.auditEvents.bulkAdd(asStored<AuditEvent>(d.auditEvents));
    await db.meta.bulkAdd(d.meta.filter((m) => m.key !== TEST_CLOCK_META_KEY));
    await db.notificationLog.bulkAdd(d.notificationLog);
    if (testClock !== undefined) await db.meta.put(testClock);
    await db.auditEvents.add({
      type: 'BACKUP_IMPORTED',
      atMs: nowMs,
      payload: {
        checksum: backup.checksum,
        exportedAtMs: backup.exportedAtMs,
        appVersion: backup.appVersion,
      },
    });
  });
  await recomputeAll(db, nowMs);
  return { ok: true, completions: d.completions.length, challenges: d.challenges.length };
}

/** Deletes every record (the UI requires typing RESET first). */
export async function resetAllData(db: DsaDatabase): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}
