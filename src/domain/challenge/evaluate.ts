import { paise, sumPaise, type Paise } from '../money';
import { PLAN_RULES, type ChallengeConfig } from './config';
import { penaltyRate, proportionalPenalty } from './penalty';

export type DayOutcome = 'SUCCESS' | 'PARTIAL_PENALIZED' | 'ZERO_GRACE' | 'ZERO_PENALIZED';

export interface DayResult {
  readonly dayIndex: number;
  readonly solved: number;
  readonly outcome: DayOutcome;
  /** Grace days consumed so far, including this day. */
  readonly graceUsedAfter: number;
  /** 1-based position in the penalized-incomplete-day sequence, or null. */
  readonly penalizedIndex: number | null;
  readonly ratePaise: Paise | null;
  readonly penaltyPaise: Paise;
}

export type ChallengeOutcome = 'IN_PROGRESS' | 'PASSED' | 'FAILED';

export interface ChallengeSummary {
  readonly daysEvaluated: number;
  readonly successDays: number;
  readonly graceUsed: number;
  readonly graceRemaining: number;
  readonly penalizedDays: number;
  readonly totalPenaltyPaise: Paise;
  readonly highestDayPenaltyPaise: Paise;
  readonly outcome: ChallengeOutcome;
  readonly canStillPass: boolean;
}

/**
 * The pure day fold (PRD §8). Grace use and the penalty index depend on earlier
 * days, so any change to day k must re-run the fold from day 0.
 */
export function evaluateDays(
  config: ChallengeConfig,
  solvedCounts: readonly number[],
): DayResult[] {
  if (solvedCounts.length > config.planDays) {
    throw new RangeError(
      `A ${config.planDays}-day challenge cannot have ${solvedCounts.length} days`,
    );
  }
  const { graceDays } = PLAN_RULES[config.planDays];
  let graceUsed = 0;
  let penalizedIndex = 0;

  return solvedCounts.map((solved, dayIndex): DayResult => {
    if (!Number.isSafeInteger(solved) || solved < 0) {
      throw new RangeError(`Invalid solved count on day ${dayIndex}: ${String(solved)}`);
    }
    if (solved >= config.dailyTarget) {
      return {
        dayIndex,
        solved,
        outcome: 'SUCCESS',
        graceUsedAfter: graceUsed,
        penalizedIndex: null,
        ratePaise: null,
        penaltyPaise: paise(0),
      };
    }
    if (solved === 0 && graceUsed < graceDays) {
      graceUsed += 1;
      return {
        dayIndex,
        solved,
        outcome: 'ZERO_GRACE',
        graceUsedAfter: graceUsed,
        penalizedIndex: null,
        ratePaise: null,
        penaltyPaise: paise(0),
      };
    }
    penalizedIndex += 1;
    const rate = penaltyRate(config, penalizedIndex);
    return {
      dayIndex,
      solved,
      outcome: solved === 0 ? 'ZERO_PENALIZED' : 'PARTIAL_PENALIZED',
      graceUsedAfter: graceUsed,
      penalizedIndex,
      ratePaise: rate,
      penaltyPaise: proportionalPenalty(rate, solved, config.dailyTarget),
    };
  });
}

export function summarize(
  config: ChallengeConfig,
  results: readonly DayResult[],
): ChallengeSummary {
  const rule = PLAN_RULES[config.planDays];
  const successDays = results.filter((r) => r.outcome === 'SUCCESS').length;
  const graceUsed = results.at(-1)?.graceUsedAfter ?? 0;
  const penalties = results.map((r) => r.penaltyPaise);
  const daysRemaining = config.planDays - results.length;
  const finished = daysRemaining === 0;
  return {
    daysEvaluated: results.length,
    successDays,
    graceUsed,
    graceRemaining: rule.graceDays - graceUsed,
    penalizedDays: results.filter((r) => r.penalizedIndex !== null).length,
    totalPenaltyPaise: sumPaise(penalties),
    highestDayPenaltyPaise: paise(Math.max(0, ...penalties)),
    outcome: !finished
      ? 'IN_PROGRESS'
      : successDays >= rule.requiredSuccessDays
        ? 'PASSED'
        : 'FAILED',
    canStillPass: successDays + daysRemaining >= rule.requiredSuccessDays,
  };
}

/** Today's result if the day ended now ("potential penalty"). */
export function projectToday(
  config: ChallengeConfig,
  closedDayCounts: readonly number[],
  todaySolved: number,
): DayResult {
  const today = evaluateDays(config, [...closedDayCounts, todaySolved]).at(-1);
  if (today === undefined) throw new Error('unreachable: projection produced no day');
  return today;
}
