import { describe, expect, it } from 'vitest';
import { parseDayKey } from '../../../src/domain/calendar';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  nextNotificationCheckMs,
  planNotifications,
  type PlannerInput,
} from '../../../src/domain/notifications/planner';

const ist = (local: string) => Date.parse(`${local}:00+05:30`);

function input(overrides: Partial<PlannerInput> = {}): PlannerInput {
  return {
    nowMs: ist('2026-11-18T20:30'),
    timeZone: 'Asia/Kolkata',
    settings: DEFAULT_NOTIFICATION_SETTINGS,
    today: { day: parseDayKey('2026-11-18'), solved: 0, target: 4, streak: 3 },
    yesterday: null,
    recentlyCompletedChallenges: [],
    sentKeys: new Set(),
    ...overrides,
  };
}

const keys = (i: PlannerInput) => planNotifications(i).map((n) => n.key);

describe('planNotifications', () => {
  it('defaults: reminder 20:00, deadline 60 min before midnight, target-met on, summary off', () => {
    expect(DEFAULT_NOTIFICATION_SETTINGS).toEqual({
      enabled: true,
      reminderTime: '20:00',
      deadlineMinutesBefore: 60,
      targetMet: true,
      dailySummary: false,
    });
  });

  it('sends nothing when disabled or no target applies', () => {
    expect(
      planNotifications(input({ settings: { ...DEFAULT_NOTIFICATION_SETTINGS, enabled: false } })),
    ).toEqual([]);
    expect(
      planNotifications(
        input({ today: { day: parseDayKey('2026-11-18'), solved: 0, target: null, streak: 0 } }),
      ),
    ).toEqual([]);
  });

  it('reminds after the reminder time, with loss-framed copy when a streak is at stake', () => {
    expect(keys(input({ nowMs: ist('2026-11-18T19:59') }))).toEqual([]);
    const [n] = planNotifications(input());
    expect(n).toMatchObject({
      key: 'reminder:2026-11-18',
      title: 'Your 3-day streak is on the line',
    });
    expect(n?.message).toBe('0 of 4 solved today. Start one problem now.');
  });

  it('uses progress copy on a partial day', () => {
    const [n] = planNotifications(
      input({ today: { day: parseDayKey('2026-11-18'), solved: 3, target: 4, streak: 0 } }),
    );
    expect(n).toMatchObject({
      title: '1 problem to go',
      message: '3 of 4 solved. Finish today’s target before midnight.',
    });
  });

  it('adds a deadline warning in the last hour', () => {
    expect(keys(input({ nowMs: ist('2026-11-18T22:59') }))).toEqual(['reminder:2026-11-18']);
    expect(keys(input({ nowMs: ist('2026-11-18T23:00') }))).toEqual([
      'reminder:2026-11-18',
      'deadline:2026-11-18',
    ]);
  });

  it('celebrates the target once per day', () => {
    const met = { day: parseDayKey('2026-11-18'), solved: 4, target: 4, streak: 4 };
    expect(planNotifications(input({ nowMs: ist('2026-11-18T09:00'), today: met }))).toEqual([
      {
        key: 'target-met:2026-11-18',
        title: 'Target met — 4-day streak',
        message: '4 of 4 solved. No virtual penalty today.',
      },
    ]);
  });

  it('never repeats a notification already sent', () => {
    expect(keys(input({ sentKeys: new Set(['reminder:2026-11-18']) }))).toEqual([]);
  });

  it('summarizes yesterday in the morning when enabled', () => {
    const i = input({
      nowMs: ist('2026-11-18T08:05'),
      settings: { ...DEFAULT_NOTIFICATION_SETTINGS, dailySummary: true },
      yesterday: { day: parseDayKey('2026-11-17'), solved: 2, target: 4, penaltyPaise: 1000 },
    });
    expect(planNotifications(i)).toEqual([
      {
        key: 'summary:2026-11-17',
        title: 'Yesterday: 2 of 4',
        message: 'Virtual penalty: ₹10. Today is a fresh start.',
      },
    ]);
  });

  it('announces a challenge result once, only if it just finished', () => {
    const i = input({
      nowMs: ist('2026-11-18T09:00'),
      recentlyCompletedChallenges: [
        { id: 'c1', status: 'PASSED', planDays: 7, successDays: 6, totalPenaltyPaise: 500 },
      ],
    });
    expect(planNotifications(i)).toEqual([
      {
        key: 'challenge:c1',
        title: '7-day challenge passed',
        message: '6 full days. Total virtual penalty ₹5.',
      },
    ]);
  });
});

describe('nextNotificationCheckMs', () => {
  it('wakes for the next reminder, deadline or summary time', () => {
    const s = { ...DEFAULT_NOTIFICATION_SETTINGS, dailySummary: true };
    expect(nextNotificationCheckMs(ist('2026-11-18T07:00'), 'Asia/Kolkata', s)).toBe(
      ist('2026-11-18T08:00'),
    );
    expect(nextNotificationCheckMs(ist('2026-11-18T08:00'), 'Asia/Kolkata', s)).toBe(
      ist('2026-11-18T20:00'),
    );
    expect(nextNotificationCheckMs(ist('2026-11-18T21:00'), 'Asia/Kolkata', s)).toBe(
      ist('2026-11-18T23:00'),
    );
    expect(nextNotificationCheckMs(ist('2026-11-18T23:30'), 'Asia/Kolkata', s)).toBe(
      ist('2026-11-19T08:00'),
    );
  });

  it('is null when notifications are off', () => {
    expect(
      nextNotificationCheckMs(0, 'Asia/Kolkata', {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        enabled: false,
      }),
    ).toBeNull();
  });
});
