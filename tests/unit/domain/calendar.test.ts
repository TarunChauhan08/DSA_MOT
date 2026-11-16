import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayKeyOf,
  daysBetween,
  DEFAULT_TIME_ZONE,
  parseDayKey,
  startOfDayMs,
} from '../../../src/domain/calendar';

const KOLKATA = DEFAULT_TIME_ZONE;
const NEW_YORK = 'America/New_York';

describe('dayKeyOf (calendar day in a time zone)', () => {
  it('uses Asia/Kolkata by default', () => {
    expect(KOLKATA).toBe('Asia/Kolkata');
  });

  it('switches day exactly at local midnight in Kolkata (UTC+05:30)', () => {
    expect(dayKeyOf(Date.parse('2026-11-15T18:29:59.999Z'), KOLKATA)).toBe('2026-11-15');
    expect(dayKeyOf(Date.parse('2026-11-15T18:30:00.000Z'), KOLKATA)).toBe('2026-11-16');
  });

  it('attributes the same instant to different days in different zones', () => {
    const instant = Date.parse('2026-11-16T02:00:00Z');
    expect(dayKeyOf(instant, KOLKATA)).toBe('2026-11-16');
    expect(dayKeyOf(instant, NEW_YORK)).toBe('2026-11-15');
  });

  it('rejects invalid time zones', () => {
    expect(() => dayKeyOf(0, 'Mars/Olympus')).toThrow(RangeError);
  });
});

describe('startOfDayMs', () => {
  it('returns local midnight as a UTC instant in Kolkata', () => {
    expect(startOfDayMs(parseDayKey('2026-11-16'), KOLKATA)).toBe(
      Date.parse('2026-11-15T18:30:00Z'),
    );
  });

  it('handles DST transitions (23-hour day in New York)', () => {
    const dstDay = parseDayKey('2026-03-08');
    expect(startOfDayMs(dstDay, NEW_YORK)).toBe(Date.parse('2026-03-08T05:00:00Z'));
    expect(startOfDayMs(addDays(dstDay, 1), NEW_YORK)).toBe(Date.parse('2026-03-09T04:00:00Z'));
  });

  it('round-trips with dayKeyOf', () => {
    const day = parseDayKey('2026-12-31');
    expect(dayKeyOf(startOfDayMs(day, KOLKATA), KOLKATA)).toBe(day);
    expect(dayKeyOf(startOfDayMs(day, KOLKATA) - 1, KOLKATA)).toBe('2026-12-30');
  });
});

describe('DayKey arithmetic', () => {
  it('validates day keys', () => {
    expect(parseDayKey('2026-11-16')).toBe('2026-11-16');
    expect(() => parseDayKey('2026-11-31')).toThrow(RangeError);
    expect(() => parseDayKey('2026-1-5')).toThrow(RangeError);
    expect(() => parseDayKey('not a day')).toThrow(RangeError);
  });

  it('adds days across months, years and leap days', () => {
    expect(addDays(parseDayKey('2026-11-30'), 1)).toBe('2026-12-01');
    expect(addDays(parseDayKey('2026-12-31'), 1)).toBe('2027-01-01');
    expect(addDays(parseDayKey('2028-02-28'), 1)).toBe('2028-02-29');
    expect(addDays(parseDayKey('2026-11-16'), -16)).toBe('2026-10-31');
  });

  it('counts days between keys', () => {
    expect(daysBetween(parseDayKey('2026-11-16'), parseDayKey('2026-11-22'))).toBe(6);
    expect(daysBetween(parseDayKey('2026-11-16'), parseDayKey('2026-11-16'))).toBe(0);
    expect(daysBetween(parseDayKey('2026-12-31'), parseDayKey('2027-01-01'))).toBe(1);
  });
});
