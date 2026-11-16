import { isValidTimeZone } from '../calendar';
import { rupeesToPaise, type Paise } from '../money';

export const PLAN_DAYS = [7, 15, 30] as const;
export type PlanDays = (typeof PLAN_DAYS)[number];

export interface PlanRule {
  readonly graceDays: number;
  readonly requiredSuccessDays: number;
}

/** PRD §3 + owner decision (ADR-0007) for the 15-day plan. */
export const PLAN_RULES: Readonly<Record<PlanDays, PlanRule>> = {
  7: { graceDays: 2, requiredSuccessDays: 5 },
  15: { graceDays: 3, requiredSuccessDays: 12 },
  30: { graceDays: 5, requiredSuccessDays: 25 },
};

export const DEFAULT_START_PENALTY_PAISE: Paise = rupeesToPaise(20);
export const DEFAULT_INCREMENT_PAISE: Paise = rupeesToPaise(20);
/** Upper bounds keep integer maths exact and catch typos (assumption, Phase 2). */
export const MAX_DAILY_TARGET = 100;
export const MAX_PENALTY_PAISE: Paise = rupeesToPaise(100_000);

export interface ChallengeConfig {
  readonly planDays: PlanDays;
  readonly dailyTarget: number;
  readonly startPenaltyPaise: Paise;
  readonly incrementPaise: Paise;
  readonly timeZone: string;
  /** Whether manual entries and Striver sheet ticks count toward the target. */
  readonly countManual: boolean;
}

export interface ConfigIssue {
  readonly field: keyof ChallengeConfig;
  readonly message: string;
}

export type ConfigValidation =
  | { readonly ok: true; readonly config: ChallengeConfig }
  | { readonly ok: false; readonly issues: readonly ConfigIssue[] };

function isWholeInRange(value: number, min: number, max: number): boolean {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

export function validateChallengeConfig(input: ChallengeConfig): ConfigValidation {
  const issues: ConfigIssue[] = [];
  if (!(PLAN_DAYS as readonly number[]).includes(input.planDays)) {
    issues.push({ field: 'planDays', message: 'Plan must be 7, 15 or 30 days.' });
  }
  if (!isWholeInRange(input.dailyTarget, 1, MAX_DAILY_TARGET)) {
    issues.push({
      field: 'dailyTarget',
      message: `Daily target must be a whole number from 1 to ${MAX_DAILY_TARGET}.`,
    });
  }
  if (!isWholeInRange(input.startPenaltyPaise, 0, MAX_PENALTY_PAISE)) {
    issues.push({ field: 'startPenaltyPaise', message: 'Starting penalty is out of range.' });
  }
  if (!isWholeInRange(input.incrementPaise, 0, MAX_PENALTY_PAISE)) {
    issues.push({ field: 'incrementPaise', message: 'Penalty increment is out of range.' });
  }
  if (!isValidTimeZone(input.timeZone)) {
    issues.push({ field: 'timeZone', message: 'Unknown time zone.' });
  }
  return issues.length === 0 ? { ok: true, config: input } : { ok: false, issues };
}
