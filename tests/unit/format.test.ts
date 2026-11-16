import { describe, expect, it } from 'vitest';
import { parseDayKey } from '../../src/domain/calendar';
import { entryLabel, formatDay, formatInr, plural } from '../../src/ui/format';

describe('formatInr', () => {
  it.each([
    [0, '₹0'],
    [500, '₹5'],
    [667, '₹6.67'],
    [5, '₹0.05'],
    [8500, '₹85'],
    [12_345_600, '₹1,23,456'],
  ])('%i paise → %s', (p, text) => {
    expect(formatInr(p)).toBe(text);
  });
});

describe('formatDay', () => {
  it('formats a day key without time-zone drift', () => {
    expect(formatDay(parseDayKey('2026-11-16'))).toBe('Mon, 16 Nov');
  });
});

describe('entryLabel', () => {
  it('never labels a sheet tick as verified or accepted', () => {
    expect(entryLabel('TUF_SHEET_CHECKBOX', 'COUNTED')).toBe('Sheet marked');
    expect(entryLabel('LC_RECENT_AC', 'COUNTED')).toBe('Verified');
    expect(entryLabel('USER_MANUAL', 'SUPERSEDED_BY_VERIFIED')).toBe('Manual — now verified');
  });
});

describe('plural', () => {
  it('pluralizes', () => {
    expect(plural(1, 'day')).toBe('1 day');
    expect(plural(2, 'day')).toBe('2 days');
  });
});
