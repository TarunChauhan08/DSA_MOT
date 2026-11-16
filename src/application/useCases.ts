import { addDays, dayKeyOf, DEFAULT_TIME_ZONE } from '../domain/calendar';
import {
  validateChallengeConfig,
  type ChallengeConfig,
  type ConfigIssue,
} from '../domain/challenge/config';
import { makeSourceKey, type Platform, type SourceKey } from '../domain/identity/identity';
import type { DsaDatabase } from '../persistence/db';
import type { ChallengeRecord, CompletionRecord } from '../persistence/records';
import { problemUrl, RawCompletionEventSchema, type RawCompletionEvent } from './completionEvent';
import type { Clock, IdGenerator } from './ports';
import { recomputeAll, type RecomputeReport } from './recompute';

export interface Deps {
  readonly db: DsaDatabase;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

/** Platform timestamps further ahead of our clock than this are rejected as bogus. */
export const MAX_CLOCK_SKEW_MS = 5 * 60_000;

/** Catch-up: finalize every closed day. Safe to call on every service-worker start. */
export async function finalizeDueDays(deps: Deps): Promise<RecomputeReport> {
  return recomputeAll(deps.db, deps.clock.now());
}

export type StartChallengeResult =
  | { readonly ok: true; readonly challenge: ChallengeRecord }
  | {
      readonly ok: false;
      readonly reason: 'INVALID_CONFIG';
      readonly issues: readonly ConfigIssue[];
    }
  | { readonly ok: false; readonly reason: 'ACTIVE_CHALLENGE_EXISTS'; readonly activeId: string };

/** Day 1 is the creation day (owner decision Q6). Configuration is frozen from here on. */
export async function startChallenge(
  deps: Deps,
  input: ChallengeConfig,
): Promise<StartChallengeResult> {
  const validation = validateChallengeConfig(input);
  if (!validation.ok) return { ok: false, reason: 'INVALID_CONFIG', issues: validation.issues };

  await finalizeDueDays(deps);
  const { db, clock, ids } = deps;
  return db.transaction('rw', [db.challenges, db.auditEvents], async () => {
    const active = await db.challenges.where('status').equals('ACTIVE').first();
    if (active !== undefined) {
      return { ok: false, reason: 'ACTIVE_CHALLENGE_EXISTS', activeId: active.id } as const;
    }
    const now = clock.now();
    const config = validation.config;
    const startDay = dayKeyOf(now, config.timeZone);
    const challenge: ChallengeRecord = {
      id: ids.next(),
      config,
      startDay,
      endDay: addDays(startDay, config.planDays - 1),
      status: 'ACTIVE',
      createdAtMs: now,
      completedAtMs: null,
    };
    await db.challenges.add(challenge);
    await db.auditEvents.add({
      type: 'CHALLENGE_STARTED',
      atMs: now,
      payload: { challengeId: challenge.id, config, startDay },
    });
    return { ok: true, challenge } as const;
  });
}

export type RecordCompletionResult =
  | { readonly status: 'recorded'; readonly id: string; readonly recompute: RecomputeReport }
  | { readonly status: 'duplicate'; readonly id: string }
  | { readonly status: 'invalid'; readonly issues: readonly string[] };

function platformOfEvent(e: RawCompletionEvent): Platform {
  switch (e.evidence) {
    case 'LC_RECENT_AC':
      return 'leetcode';
    case 'TUF_SUBMISSION_ACCEPTED':
    case 'TUF_SHEET_CHECKBOX':
      return 'tuf';
    case 'USER_MANUAL':
      return e.platform;
  }
}

/**
 * Ingests one completion from any source, idempotently, then re-derives results
 * so late-arriving data revises earlier days deterministically.
 */
export async function recordCompletion(deps: Deps, raw: unknown): Promise<RecordCompletionResult> {
  const parsed = RawCompletionEventSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: 'invalid',
      issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }
  const event = parsed.data;
  const now = deps.clock.now();
  const platform = platformOfEvent(event);
  const sourceKey = makeSourceKey(platform, event.slug);

  let id: string;
  let sourceTimestampMs: number;
  switch (event.evidence) {
    case 'LC_RECENT_AC':
      id = `lc-ac:${event.submissionId}`;
      sourceTimestampMs = event.sourceTimestampMs;
      break;
    case 'TUF_SUBMISSION_ACCEPTED':
      id = `tuf-ac:${event.submissionId}`;
      sourceTimestampMs = event.sourceTimestampMs;
      break;
    case 'TUF_SHEET_CHECKBOX':
      // One tick per problem per day; ticking again on a later day counts again (Q2).
      id = `tuf-sheet:${sourceKey}:${dayKeyOf(now, DEFAULT_TIME_ZONE)}`;
      sourceTimestampMs = now;
      break;
    case 'USER_MANUAL':
      // No backdating (owner decision Q3): a manual entry belongs to the moment it is made.
      id = `manual:${deps.ids.next()}`;
      sourceTimestampMs = now;
      break;
  }
  if (sourceTimestampMs > now + MAX_CLOCK_SKEW_MS) {
    return { status: 'invalid', issues: ['sourceTimestampMs: in the future'] };
  }

  const record: CompletionRecord = {
    id,
    sourceKey,
    evidence: event.evidence,
    sourceTimestampMs,
    discoveredAtMs: now,
    title: event.title,
    url: problemUrl(platform, event.slug),
  };
  const { db } = deps;
  const inserted = await db.transaction('rw', [db.completions, db.auditEvents], async () => {
    if ((await db.completions.get(id)) !== undefined) return false;
    await db.completions.add(record);
    await db.auditEvents.add({
      type: 'COMPLETION_RECORDED',
      atMs: now,
      payload: { id, sourceKey, evidence: event.evidence, sourceTimestampMs },
    });
    return true;
  });
  if (!inserted) return { status: 'duplicate', id };
  return { status: 'recorded', id, recompute: await recomputeAll(db, now) };
}

/**
 * Records the user's "same problem / different problem" decision for two source keys
 * and recomputes, so affected days are revised with an audit trail (ADR-0006).
 */
export async function decideMapping(
  deps: Deps,
  a: SourceKey,
  b: SourceKey,
  decision: 'SAME' | 'DIFFERENT',
): Promise<RecomputeReport> {
  if (a === b) throw new RangeError('Cannot map a problem to itself');
  const now = deps.clock.now();
  const [first, second] = a < b ? [a, b] : [b, a];
  const { db } = deps;
  await db.transaction('rw', [db.mappings, db.auditEvents], async () => {
    await db.mappings.put({
      id: `${first}|${second}`,
      a: first,
      b: second,
      decision,
      decidedAtMs: now,
    });
    await db.auditEvents.add({
      type: 'MAPPING_DECIDED',
      atMs: now,
      payload: { a: first, b: second, decision },
    });
  });
  return recomputeAll(db, now);
}
