import { addDays, dayKeyOf, startOfDayMs, type DayKey } from '../calendar';
import { formatRupees } from '../money';

export interface NotificationSettings {
  readonly enabled: boolean;
  /** Local "HH:MM" for the daily nudge if the target is not met yet. */
  readonly reminderTime: string;
  /** Minutes before midnight for the last-call warning; 0 turns it off. */
  readonly deadlineMinutesBefore: number;
  readonly targetMet: boolean;
  readonly dailySummary: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  reminderTime: '20:00',
  deadlineMinutesBefore: 60,
  targetMet: true,
  dailySummary: false,
};

/** Morning summary of yesterday. */
export const SUMMARY_MINUTE = 8 * 60;
const MINUTES_PER_DAY = 24 * 60;
const MS_PER_MINUTE = 60_000;

export interface PlannerInput {
  readonly nowMs: number;
  readonly timeZone: string;
  readonly settings: NotificationSettings;
  readonly today: {
    readonly day: DayKey;
    readonly solved: number;
    readonly target: number | null;
    readonly streak: number;
  };
  readonly yesterday: {
    readonly day: DayKey;
    readonly solved: number;
    readonly target: number;
    readonly penaltyPaise: number;
  } | null;
  /** Challenges that finished recently (the caller decides "recently"). */
  readonly recentlyCompletedChallenges: ReadonlyArray<{
    readonly id: string;
    readonly status: 'PASSED' | 'FAILED';
    readonly planDays: number;
    readonly successDays: number;
    readonly totalPenaltyPaise: number;
  }>;
  /** Keys already sent (notificationLog) — guarantees each fires at most once. */
  readonly sentKeys: ReadonlySet<string>;
}

export interface PlannedNotification {
  readonly key: string;
  readonly title: string;
  readonly message: string;
}

export function parseClock(hhmm: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (m === null) throw new RangeError(`Invalid time: ${hhmm}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

function minutesIntoDay(nowMs: number, timeZone: string): number {
  return Math.floor((nowMs - startOfDayMs(dayKeyOf(nowMs, timeZone), timeZone)) / MS_PER_MINUTE);
}

const problems = (n: number) => `${String(n)} problem${n === 1 ? '' : 's'}`;

/** Which notifications are due now. Pure: the service worker sends and logs them. */
export function planNotifications(input: PlannerInput): PlannedNotification[] {
  const { settings, today } = input;
  if (!settings.enabled) return [];
  const minute = minutesIntoDay(input.nowMs, input.timeZone);
  const out: PlannedNotification[] = [];

  if (today.target !== null) {
    const remaining = today.target - today.solved;
    const progress = `${String(today.solved)} of ${String(today.target)}`;
    if (remaining > 0 && minute >= parseClock(settings.reminderTime)) {
      out.push({
        key: `reminder:${today.day}`,
        title:
          today.streak > 0
            ? `Your ${String(today.streak)}-day streak is on the line`
            : today.solved === 0
              ? 'No DSA yet today'
              : `${problems(remaining)} to go`,
        message:
          today.solved === 0
            ? `${progress} solved today. Start one problem now.`
            : `${progress} solved. Finish today’s target before midnight.`,
      });
    }
    if (
      remaining > 0 &&
      settings.deadlineMinutesBefore > 0 &&
      MINUTES_PER_DAY - minute <= settings.deadlineMinutesBefore
    ) {
      out.push({
        key: `deadline:${today.day}`,
        title: `${String(MINUTES_PER_DAY - minute)} minutes left today`,
        message: `${progress} solved. ${problems(remaining)} left before the day closes.`,
      });
    }
    if (remaining <= 0 && settings.targetMet) {
      out.push({
        key: `target-met:${today.day}`,
        title: `Target met — ${String(today.streak)}-day streak`,
        message: `${progress} solved. No virtual penalty today.`,
      });
    }
  }

  if (settings.dailySummary && input.yesterday !== null && minute >= SUMMARY_MINUTE) {
    const y = input.yesterday;
    out.push({
      key: `summary:${y.day}`,
      title: `Yesterday: ${String(y.solved)} of ${String(y.target)}`,
      message:
        y.penaltyPaise > 0
          ? `Virtual penalty: ${formatRupees(y.penaltyPaise)}. Today is a fresh start.`
          : 'No virtual penalty. Keep it going today.',
    });
  }

  for (const c of input.recentlyCompletedChallenges) {
    out.push({
      key: `challenge:${c.id}`,
      title: `${String(c.planDays)}-day challenge ${c.status === 'PASSED' ? 'passed' : 'failed'}`,
      message: `${String(c.successDays)} full days. Total virtual penalty ${formatRupees(c.totalPenaltyPaise)}.`,
    });
  }

  return out.filter((n) => !input.sentKeys.has(n.key));
}

/** Next instant a timed notification could become due (for the reminder alarm). */
export function nextNotificationCheckMs(
  nowMs: number,
  timeZone: string,
  settings: NotificationSettings,
): number | null {
  if (!settings.enabled) return null;
  const minutes = [parseClock(settings.reminderTime)];
  if (settings.deadlineMinutesBefore > 0)
    minutes.push(MINUTES_PER_DAY - settings.deadlineMinutesBefore);
  if (settings.dailySummary) minutes.push(SUMMARY_MINUTE);
  const today = dayKeyOf(nowMs, timeZone);
  const candidates = [today, addDays(today, 1)].flatMap((day) =>
    minutes.map((m) => startOfDayMs(day, timeZone) + m * MS_PER_MINUTE),
  );
  return Math.min(...candidates.filter((t) => t > nowMs));
}
