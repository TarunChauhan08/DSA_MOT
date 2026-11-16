import { describe, expect, it } from 'vitest';
import { paise, roundHalfUpDiv, rupeesToPaise, sumPaise } from '../../../src/domain/money';

describe('money (integer paise)', () => {
  it('converts whole rupees to paise', () => {
    expect(rupeesToPaise(20)).toBe(2000);
    expect(rupeesToPaise(0)).toBe(0);
  });

  it('rejects non-integer, negative or unsafe amounts', () => {
    expect(() => rupeesToPaise(20.5)).toThrow(RangeError);
    expect(() => paise(-1)).toThrow(RangeError);
    expect(() => paise(1.5)).toThrow(RangeError);
    expect(() => paise(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
    expect(() => paise(Number.NaN)).toThrow(RangeError);
  });

  it.each([
    [2000, 1, 3, 667], // 666.67 → 667
    [2000, 2, 3, 1333], // 1333.33 → 1333
    [2500, 1, 8, 313], // 312.5 → 313 (half rounds up)
    [2000, 1, 4, 500],
    [0, 1, 4, 0],
    [1, 1, 2, 1], // 0.5 → 1
    [1, 1, 3, 0], // 0.33 → 0
  ])('roundHalfUpDiv(%i × %i / %i) = %i', (rate, shortfall, target, expected) => {
    expect(roundHalfUpDiv(rate * shortfall, target)).toBe(expected);
  });

  it('rejects a zero or negative denominator', () => {
    expect(() => roundHalfUpDiv(10, 0)).toThrow(RangeError);
    expect(() => roundHalfUpDiv(10, -2)).toThrow(RangeError);
  });

  it('sums paise exactly', () => {
    expect(sumPaise([paise(500), paise(2000), paise(6000)])).toBe(8500);
    expect(sumPaise([])).toBe(0);
  });
});

describe('money guards', () => {
  it('rejects negative or fractional numerators', () => {
    expect(() => roundHalfUpDiv(-1, 3)).toThrow(RangeError);
    expect(() => roundHalfUpDiv(1.5, 3)).toThrow(RangeError);
  });

  it('refuses amounts too large for exact integer arithmetic', () => {
    expect(() => roundHalfUpDiv(Number.MAX_SAFE_INTEGER, 3)).toThrow(RangeError);
  });
});
