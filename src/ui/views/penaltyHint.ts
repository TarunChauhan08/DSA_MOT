import type { DayResult } from '../../domain/challenge/evaluate';
import { formatInr } from '../format';

/** Plain-language "if the day ended now" line for the Today view and popup. */
export function penaltyHint(projected: DayResult): string {
  switch (projected.outcome) {
    case 'SUCCESS':
      return 'Target met — no virtual penalty today.';
    case 'ZERO_GRACE':
      return 'Nothing solved yet. If the day ends like this, it uses a grace day (no penalty).';
    case 'ZERO_PENALIZED':
    case 'PARTIAL_PENALIZED':
      return `If the day ended now: ${formatInr(projected.penaltyPaise)} virtual penalty.`;
  }
}
