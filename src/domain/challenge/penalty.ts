import { paise, roundHalfUpDiv, type Paise } from '../money';
import type { ChallengeConfig } from './config';

/** Rate for the n-th penalized incomplete day (1-based): start + (n − 1) × increment. */
export function penaltyRate(config: ChallengeConfig, penalizedIndex: number): Paise {
  if (!Number.isSafeInteger(penalizedIndex) || penalizedIndex < 1) {
    throw new RangeError(`Penalized index must be ≥ 1: ${String(penalizedIndex)}`);
  }
  return paise(config.startPenaltyPaise + (penalizedIndex - 1) * config.incrementPaise);
}

/** roundHalfUp(rate × shortfall / target). Zero solved → the full rate. */
export function proportionalPenalty(rate: Paise, solved: number, target: number): Paise {
  const shortfall = Math.max(0, target - solved);
  if (shortfall === 0) return paise(0);
  return paise(roundHalfUpDiv(rate * shortfall, target));
}
