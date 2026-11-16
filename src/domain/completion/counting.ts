import { dayKeyOf, type DayKey } from '../calendar';
import type { CanonicalKey, SourceKey } from '../identity/identity';

/** Where a completion fact came from (ADR-0004, owner decision Q7). */
export type Evidence =
  | 'LC_RECENT_AC' // LeetCode public recent-accepted list (username check)
  | 'TUF_SUBMISSION_ACCEPTED' // takeUforward judge verdict
  | 'TUF_SHEET_CHECKBOX' // "Sheet marked complete" — never shown as Accepted
  | 'USER_MANUAL';

/** PRD §4 verification types. Duplicate/excluded is derived per day by `countDay`. */
export type Verification = 'AUTO_VERIFIED' | 'MANUAL' | 'AWAITING_VERIFICATION';

export function verificationOf(evidence: Evidence): Verification {
  switch (evidence) {
    case 'LC_RECENT_AC':
    case 'TUF_SUBMISSION_ACCEPTED':
      return 'AUTO_VERIFIED';
    case 'TUF_SHEET_CHECKBOX':
    case 'USER_MANUAL':
      return 'MANUAL';
  }
}

export interface CompletionFact {
  readonly id: string;
  readonly sourceKey: SourceKey;
  readonly canonicalKey: CanonicalKey;
  readonly evidence: Evidence;
  /** When the platform says it happened (not when we discovered it). */
  readonly sourceTimestampMs: number;
  readonly title: string;
}

export type EntryStatus =
  'COUNTED' | 'DUPLICATE_EXCLUDED' | 'SUPERSEDED_BY_VERIFIED' | 'MANUAL_DISABLED';

export interface CountedEntry {
  readonly fact: CompletionFact;
  readonly status: EntryStatus;
  /** The fact that counted for this problem, when this one did not. */
  readonly countedAs?: string;
}

export interface DayCount {
  readonly count: number;
  readonly entries: readonly CountedEntry[];
}

const PRIORITY: Readonly<Record<Evidence, number>> = {
  LC_RECENT_AC: 0,
  TUF_SUBMISSION_ACCEPTED: 0,
  TUF_SHEET_CHECKBOX: 1,
  USER_MANUAL: 2,
};

const isAuto = (f: CompletionFact) => verificationOf(f.evidence) === 'AUTO_VERIFIED';

function compareFacts(x: CompletionFact, y: CompletionFact): number {
  return (
    PRIORITY[x.evidence] - PRIORITY[y.evidence] ||
    x.sourceTimestampMs - y.sourceTimestampMs ||
    (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)
  );
}

/**
 * Counts unique problems solved on one day. Uniqueness is per day (owner decision Q2):
 * the same canonical problem counts at most once per day, but again on later days.
 */
export function countDay(
  facts: readonly CompletionFact[],
  options: { readonly countManual: boolean },
): DayCount {
  const groups = new Map<CanonicalKey, CompletionFact[]>();
  for (const f of facts) {
    const group = groups.get(f.canonicalKey) ?? [];
    group.push(f);
    groups.set(f.canonicalKey, group);
  }

  const entries: CountedEntry[] = [];
  let count = 0;
  for (const key of [...groups.keys()].sort()) {
    const group = [...(groups.get(key) ?? [])].sort(compareFacts);
    const representative = group.find((f) => isAuto(f) || options.countManual);
    if (representative === undefined) {
      group.forEach((fact) => entries.push({ fact, status: 'MANUAL_DISABLED' }));
      continue;
    }
    count += 1;
    for (const fact of group) {
      if (fact === representative) {
        entries.push({ fact, status: 'COUNTED' });
      } else if (isAuto(representative) && !isAuto(fact)) {
        entries.push({ fact, status: 'SUPERSEDED_BY_VERIFIED', countedAs: representative.id });
      } else {
        // Same tier as the representative (or both manual with counting on).
        entries.push({ fact, status: 'DUPLICATE_EXCLUDED', countedAs: representative.id });
      }
    }
  }
  return { count, entries };
}

/** Buckets facts by the calendar day of their source timestamp. */
export function groupByDay(
  facts: readonly CompletionFact[],
  timeZone: string,
): Map<DayKey, CompletionFact[]> {
  const byDay = new Map<DayKey, CompletionFact[]>();
  const ordered = [...facts].sort(
    (a, b) => a.sourceTimestampMs - b.sourceTimestampMs || (a.id < b.id ? -1 : 1),
  );
  for (const f of ordered) {
    const day = dayKeyOf(f.sourceTimestampMs, timeZone);
    const list = byDay.get(day) ?? [];
    list.push(f);
    byDay.set(day, list);
  }
  return byDay;
}
