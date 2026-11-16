/**
 * Money is always integer paise. Floating-point currency maths is forbidden
 * (docs/PRD.md §8 "Money precision").
 */
export type Paise = number & { readonly __brand: 'Paise' };

const PAISE_PER_RUPEE = 100;

export function paise(value: number): Paise {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`Invalid paise amount: ${String(value)}`);
  }
  return value as Paise;
}

export function rupeesToPaise(wholeRupees: number): Paise {
  if (!Number.isSafeInteger(wholeRupees)) {
    throw new RangeError(`Rupee amounts must be whole numbers: ${String(wholeRupees)}`);
  }
  return paise(wholeRupees * PAISE_PER_RUPEE);
}

/**
 * Deterministic round-half-up of numerator / denominator for non-negative integers,
 * computed without floating point: floor((2n + d) / 2d).
 */
export function roundHalfUpDiv(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new RangeError(`Denominator must be a positive integer: ${String(denominator)}`);
  }
  if (!Number.isSafeInteger(numerator) || numerator < 0) {
    throw new RangeError(`Numerator must be a non-negative integer: ${String(numerator)}`);
  }
  const doubled = 2 * numerator + denominator;
  if (!Number.isSafeInteger(doubled)) {
    throw new RangeError('Amount too large for exact integer arithmetic');
  }
  return Math.floor(doubled / (2 * denominator));
}

export function sumPaise(amounts: readonly Paise[]): Paise {
  return paise(amounts.reduce<number>((total, amount) => total + amount, 0));
}
