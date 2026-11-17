import type { DayKey } from '../domain/calendar';
import type { ChallengeConfig } from '../domain/challenge/config';
import type { DayOutcome } from '../domain/challenge/evaluate';
import type { Evidence } from '../domain/completion/counting';
import type { MappingDecision, SourceKey } from '../domain/identity/identity';
import type { Paise } from '../domain/money';

export type ChallengeStatus = 'ACTIVE' | 'PASSED' | 'FAILED';

export interface ChallengeRecord {
  readonly id: string;
  /** Frozen at start; never edited afterwards (PRD §3). */
  readonly config: ChallengeConfig;
  readonly startDay: DayKey;
  readonly endDay: DayKey;
  status: ChallengeStatus;
  readonly createdAtMs: number;
  completedAtMs: number | null;
}

export interface ChallengeDayRecord {
  readonly challengeId: string;
  readonly day: DayKey;
  readonly dayIndex: number;
  readonly solved: number;
  readonly countedCompletionIds: readonly string[];
  readonly outcome: DayOutcome;
  readonly graceUsedAfter: number;
  readonly penalizedIndex: number | null;
  readonly ratePaise: Paise | null;
  readonly penaltyPaise: Paise;
  /** Deterministic fingerprint of everything the result depends on. */
  readonly inputsKey: string;
  readonly revision: number;
  readonly finalizedAtMs: number;
}

/** Append-only ledger; the current value for a day is its highest revision. */
export interface PenaltyRecord {
  readonly id?: number;
  readonly challengeId: string;
  readonly day: DayKey;
  readonly revision: number;
  readonly ratePaise: Paise | null;
  readonly penaltyPaise: Paise;
  readonly reason: 'FINALIZED' | 'REVISED';
  readonly recordedAtMs: number;
}

export interface CompletionRecord {
  /** Deterministic for platform events (idempotent ingest), random for manual entries. */
  readonly id: string;
  readonly sourceKey: SourceKey;
  readonly evidence: Evidence;
  readonly sourceTimestampMs: number;
  readonly discoveredAtMs: number;
  readonly title: string;
  readonly url: string;
}

export interface MappingRecord extends MappingDecision {
  /** Unordered pair key "a|b" (a < b). */
  readonly id: string;
}

export type AuditType =
  | 'CHALLENGE_STARTED'
  | 'COMPLETION_RECORDED'
  | 'DAY_FINALIZED'
  | 'DAY_REVISED'
  | 'CHALLENGE_COMPLETED'
  | 'CHALLENGE_OUTCOME_REVISED'
  | 'MAPPING_DECIDED';

export interface AuditEvent {
  readonly seq?: number;
  readonly type: AuditType;
  readonly atMs: number;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface MetaRecord {
  readonly key: string;
  readonly value: unknown;
}

export interface NotificationLogRecord {
  readonly eventKey: string;
  readonly sentAtMs: number;
}
