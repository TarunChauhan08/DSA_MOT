import { paise, roundHalfUpDiv, type Paise } from '../money';

export interface PenaltyStats {
  readonly totalPaise: Paise;
  readonly highestPaise: Paise;
  readonly evaluatedDays: number;
  readonly penalizedDays: number;
  /** Total ÷ evaluated challenge days (round half up). */
  readonly averagePerDayPaise: Paise;
  /** Total ÷ penalized days (round half up). */
  readonly averagePerPenalizedDayPaise: Paise;
}

export function penaltyStats(
  days: ReadonlyArray<{ readonly penaltyPaise: Paise; readonly penalized: boolean }>,
): PenaltyStats {
  const total = days.reduce((t, d) => t + d.penaltyPaise, 0);
  const penalizedDays = days.filter((d) => d.penalized).length;
  return {
    totalPaise: paise(total),
    highestPaise: paise(days.reduce((m, d) => Math.max(m, d.penaltyPaise), 0)),
    evaluatedDays: days.length,
    penalizedDays,
    averagePerDayPaise: paise(days.length === 0 ? 0 : roundHalfUpDiv(total, days.length)),
    averagePerPenalizedDayPaise: paise(
      penalizedDays === 0 ? 0 : roundHalfUpDiv(total, penalizedDays),
    ),
  };
}
