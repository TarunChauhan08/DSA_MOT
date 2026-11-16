/**
 * Calendar days in an IANA time zone. A "day" is local 00:00 → 24:00
 * (owner decision ADR-0007). Uses only Intl — no clock reads.
 */
export type DayKey = string & { readonly __brand: 'DayKey' };

export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function formatter(cache: Map<string, Intl.DateTimeFormat>, timeZone: string, withTime: boolean) {
  let f = cache.get(timeZone);
  if (f === undefined) {
    // Throws RangeError for unknown time zones.
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...(withTime
        ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' as const }
        : {}),
    });
    cache.set(timeZone, f);
  }
  return f;
}

type PartName = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second';

function partsOf(f: Intl.DateTimeFormat, instantMs: number): (name: PartName) => number {
  const parts = f.formatToParts(instantMs);
  return (name) => {
    const found = parts.find((p) => p.type === name);
    if (found === undefined) throw new Error(`Intl did not return a ${name} part`);
    return Number(found.value);
  };
}

function toKey(year: number, month: number, day: number): DayKey {
  const pad = (n: number, width: number) => String(n).padStart(width, '0');
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}` as DayKey;
}

function utcMidnightOf(day: DayKey): number {
  const m = DAY_KEY_PATTERN.exec(day);
  if (m === null) throw new RangeError(`Invalid day key: ${day}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatter(dateFormatters, timeZone, false);
    return true;
  } catch (error: unknown) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}

export function parseDayKey(value: string): DayKey {
  const m = DAY_KEY_PATTERN.exec(value);
  if (m === null) throw new RangeError(`Invalid day key: ${value}`);
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const roundTrip = new Date(Date.UTC(year, month - 1, day));
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid calendar date: ${value}`);
  }
  return value as DayKey;
}

/** The calendar day an instant falls on in `timeZone`. */
export function dayKeyOf(instantMs: number, timeZone: string): DayKey {
  const part = partsOf(formatter(dateFormatters, timeZone, false), instantMs);
  return toKey(part('year'), part('month'), part('day'));
}

function offsetMs(instantMs: number, timeZone: string): number {
  const part = partsOf(formatter(dateTimeFormatters, timeZone, true), instantMs);
  const asUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return asUtc - (instantMs - (((instantMs % 1000) + 1000) % 1000));
}

/** UTC instant of local midnight that starts `day` in `timeZone` (DST-aware). */
export function startOfDayMs(day: DayKey, timeZone: string): number {
  const utcMidnight = utcMidnightOf(day);
  const firstGuess = utcMidnight - offsetMs(utcMidnight, timeZone);
  return utcMidnight - offsetMs(firstGuess, timeZone);
}

export function addDays(day: DayKey, days: number): DayKey {
  if (!Number.isSafeInteger(days)) throw new RangeError(`Invalid day offset: ${String(days)}`);
  const d = new Date(utcMidnightOf(day) + days * MS_PER_DAY);
  return toKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((utcMidnightOf(to) - utcMidnightOf(from)) / MS_PER_DAY);
}
