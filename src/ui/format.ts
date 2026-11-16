import type { DayKey } from '../domain/calendar';
import type { DayOutcome } from '../domain/challenge/evaluate';
import type { EntryStatus, Evidence } from '../domain/completion/counting';
import type { Platform } from '../domain/identity/identity';

const PAISE_PER_RUPEE = 100;
const rupeeGrouping = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** ₹1,234 or ₹6.67 — formatted from integer paise without floating-point maths. */
export function formatInr(paiseAmount: number): string {
  const rupees = Math.floor(paiseAmount / PAISE_PER_RUPEE);
  const rest = paiseAmount % PAISE_PER_RUPEE;
  const fraction = rest === 0 ? '' : `.${String(rest).padStart(2, '0')}`;
  return `₹${rupeeGrouping.format(rupees)}${fraction}`;
}

const dayFormat = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

export function formatDay(day: DayKey): string {
  return dayFormat.format(Date.parse(`${day}T00:00:00Z`));
}

export const OUTCOME_LABEL: Record<DayOutcome, string> = {
  SUCCESS: 'Target met',
  PARTIAL_PENALIZED: 'Partial',
  ZERO_GRACE: 'Grace day',
  ZERO_PENALIZED: 'Missed',
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  leetcode: 'LeetCode',
  tuf: 'Striver A2Z',
};

/** Never call a sheet tick "Accepted" (PRD §6). */
export function entryLabel(evidence: Evidence, status: EntryStatus): string {
  switch (status) {
    case 'DUPLICATE_EXCLUDED':
      return 'Duplicate — not counted';
    case 'SUPERSEDED_BY_VERIFIED':
      return 'Manual — now verified';
    case 'MANUAL_DISABLED':
      return 'Manual — not counted';
    case 'COUNTED':
      switch (evidence) {
        case 'LC_RECENT_AC':
        case 'TUF_SUBMISSION_ACCEPTED':
          return 'Verified';
        case 'TUF_SHEET_CHECKBOX':
          return 'Sheet marked';
        case 'USER_MANUAL':
          return 'Manual';
      }
  }
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${String(n)} ${n === 1 ? one : many}`;
}
