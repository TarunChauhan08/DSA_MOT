import { addDays, dayKeyOf, daysBetween, type DayKey } from '../domain/calendar';
import type { ChallengeConfig } from '../domain/challenge/config';
import { evaluateDays, projectToday, type DayResult } from '../domain/challenge/evaluate';
import { countDay, type CompletionFact, type DayCount } from '../domain/completion/counting';
import { resolveCanonicalKeys, soloCanonicalKey } from '../domain/identity/identity';
import type { CompletionRecord, MappingRecord } from '../persistence/records';

/** Attaches canonical identity (from user mapping decisions) to stored completions. */
export function toFacts(
  completions: readonly CompletionRecord[],
  mappings: readonly MappingRecord[],
): CompletionFact[] {
  const canonical = resolveCanonicalKeys(
    completions.map((c) => c.sourceKey),
    mappings,
  );
  return completions.map((c) => ({
    id: c.id,
    sourceKey: c.sourceKey,
    canonicalKey: canonical.get(c.sourceKey) ?? soloCanonicalKey(c.sourceKey),
    evidence: c.evidence,
    sourceTimestampMs: c.sourceTimestampMs,
    title: c.title,
  }));
}

export interface DerivedChallenge {
  readonly dayKeys: readonly DayKey[];
  /** Days before today (in the challenge zone), capped at the plan length. */
  readonly closedDays: number;
  /** Index of today within the plan, or null if today is outside it. */
  readonly todayIndex: number | null;
  /** Counts for closed days, then today (if inside the plan). */
  readonly counts: readonly DayCount[];
  readonly closedResults: readonly DayResult[];
  readonly projectedToday: DayResult | null;
}

/**
 * Single source of truth for a challenge's day-by-day state. Used by the
 * persisting recompute and by the read-only dashboard, so they never disagree.
 */
export function deriveChallenge(
  config: ChallengeConfig,
  startDay: DayKey,
  factsByDay: ReadonlyMap<DayKey, readonly CompletionFact[]>,
  nowMs: number,
): DerivedChallenge {
  const today = dayKeyOf(nowMs, config.timeZone);
  const offset = daysBetween(startDay, today);
  const closedDays = Math.min(Math.max(offset, 0), config.planDays);
  const todayIndex = offset >= 0 && offset < config.planDays ? offset : null;
  const dayKeys = Array.from({ length: config.planDays }, (_, i) => addDays(startDay, i));
  const countedDays = closedDays + (todayIndex === null ? 0 : 1);
  const counts = dayKeys
    .slice(0, countedDays)
    .map((day) => countDay(factsByDay.get(day) ?? [], { countManual: config.countManual }));
  const closedCounts = counts.slice(0, closedDays).map((c) => c.count);
  const todayCount = todayIndex === null ? undefined : counts[todayIndex];

  return {
    dayKeys,
    closedDays,
    todayIndex,
    counts,
    closedResults: evaluateDays(config, closedCounts),
    projectedToday:
      todayCount === undefined ? null : projectToday(config, closedCounts, todayCount.count),
  };
}
