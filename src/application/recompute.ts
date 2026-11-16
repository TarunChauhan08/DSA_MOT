import { addDays, dayKeyOf, daysBetween, startOfDayMs } from '../domain/calendar';
import { summarize } from '../domain/challenge/evaluate';
import { groupByDay } from '../domain/completion/counting';
import type { DsaDatabase } from '../persistence/db';
import { deriveChallenge, toFacts } from './derive';
import type {
  ChallengeDayRecord,
  ChallengeRecord,
  ChallengeStatus,
  MappingRecord,
} from '../persistence/records';

export interface RecomputeReport {
  finalized: number;
  revised: number;
  completed: number;
}

/**
 * Re-derives every closed day of every challenge from stored completions.
 * Idempotent: a day is only written when its inputsKey changes, so running
 * this twice (or after a browser restart) never double-charges (ADR-0005).
 */
export async function recomputeAll(db: DsaDatabase, nowMs: number): Promise<RecomputeReport> {
  const report: RecomputeReport = { finalized: 0, revised: 0, completed: 0 };
  await db.transaction(
    'rw',
    [
      db.challenges,
      db.challengeDays,
      db.penaltyRecords,
      db.completions,
      db.mappings,
      db.auditEvents,
    ],
    async () => {
      const mappings = await db.mappings.toArray();
      for (const challenge of await db.challenges.toArray()) {
        await recomputeChallenge(db, challenge, mappings, nowMs, report);
      }
    },
  );
  return report;
}

async function recomputeChallenge(
  db: DsaDatabase,
  challenge: ChallengeRecord,
  mappings: readonly MappingRecord[],
  nowMs: number,
  report: RecomputeReport,
): Promise<void> {
  const { config } = challenge;
  const tz = config.timeZone;
  const today = dayKeyOf(nowMs, tz);
  const closedDays = Math.min(Math.max(daysBetween(challenge.startDay, today), 0), config.planDays);
  if (closedDays === 0) return;

  const completions = await db.completions
    .where('sourceTimestampMs')
    .between(
      startOfDayMs(challenge.startDay, tz),
      startOfDayMs(addDays(challenge.startDay, closedDays), tz),
      true,
      false,
    )
    .toArray();
  const derived = deriveChallenge(
    config,
    challenge.startDay,
    groupByDay(toFacts(completions, mappings), tz),
    nowMs,
  );
  const results = derived.closedResults;
  const days = derived.dayKeys;
  const counts = derived.counts;

  const existing = new Map(
    (await db.challengeDays.where('challengeId').equals(challenge.id).toArray()).map((d) => [
      d.day,
      d,
    ]),
  );

  for (const [i, result] of results.entries()) {
    const day = days[i];
    const count = counts[i];
    if (day === undefined || count === undefined) continue;
    const countedCompletionIds = count.entries
      .filter((e) => e.status === 'COUNTED')
      .map((e) => e.fact.id)
      .sort();
    const inputsKey = JSON.stringify([
      countedCompletionIds,
      result.solved,
      result.outcome,
      result.graceUsedAfter,
      result.penalizedIndex,
      result.ratePaise,
      result.penaltyPaise,
    ]);
    const previous = existing.get(day);
    if (previous?.inputsKey === inputsKey) continue;

    const record: ChallengeDayRecord = {
      challengeId: challenge.id,
      day,
      dayIndex: i,
      solved: result.solved,
      countedCompletionIds,
      outcome: result.outcome,
      graceUsedAfter: result.graceUsedAfter,
      penalizedIndex: result.penalizedIndex,
      ratePaise: result.ratePaise,
      penaltyPaise: result.penaltyPaise,
      inputsKey,
      revision: (previous?.revision ?? 0) + 1,
      finalizedAtMs: nowMs,
    };
    await db.challengeDays.put(record);

    const penaltyChanged =
      previous === undefined ||
      previous.penaltyPaise !== record.penaltyPaise ||
      previous.ratePaise !== record.ratePaise;
    if (penaltyChanged) {
      await db.penaltyRecords.add({
        challengeId: challenge.id,
        day,
        revision: record.revision,
        ratePaise: record.ratePaise,
        penaltyPaise: record.penaltyPaise,
        reason: previous === undefined ? 'FINALIZED' : 'REVISED',
        recordedAtMs: nowMs,
      });
    }
    await db.auditEvents.add({
      type: previous === undefined ? 'DAY_FINALIZED' : 'DAY_REVISED',
      atMs: nowMs,
      payload: {
        challengeId: challenge.id,
        day,
        revision: record.revision,
        outcome: record.outcome,
        penaltyPaise: record.penaltyPaise,
        ...(previous === undefined
          ? {}
          : { previousOutcome: previous.outcome, previousPenaltyPaise: previous.penaltyPaise }),
      },
    });
    if (previous === undefined) report.finalized += 1;
    else report.revised += 1;
  }

  if (closedDays < config.planDays) return;
  const outcome = summarize(config, results).outcome;
  const status: ChallengeStatus = outcome === 'PASSED' ? 'PASSED' : 'FAILED';
  if (challenge.status === status) return;

  const wasActive = challenge.status === 'ACTIVE';
  await db.challenges.update(challenge.id, {
    status,
    completedAtMs: challenge.completedAtMs ?? nowMs,
  });
  await db.auditEvents.add({
    type: wasActive ? 'CHALLENGE_COMPLETED' : 'CHALLENGE_OUTCOME_REVISED',
    atMs: nowMs,
    payload: { challengeId: challenge.id, status, previousStatus: challenge.status },
  });
  if (wasActive) report.completed += 1;
}
