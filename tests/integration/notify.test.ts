import { describe, expect, it } from 'vitest';
import {
  badgeFor,
  collectDueNotifications,
  markNotificationSent,
} from '../../src/application/notify';
import { loadDashboard } from '../../src/application/queries';
import { DEFAULT_SETTINGS, readSettings, writeSettings } from '../../src/application/settings';
import { finalizeDueDays, recordCompletion, startChallenge } from '../../src/application/useCases';
import { config, makeDeps } from './helpers';

type D = ReturnType<typeof makeDeps>;
const manual = (deps: D, slug: string) =>
  recordCompletion(deps, { evidence: 'USER_MANUAL', platform: 'leetcode', slug, title: slug });

describe('collectDueNotifications', () => {
  it('nothing before any challenge', async () => {
    const deps = makeDeps('2026-11-16T21:00');
    expect(await collectDueNotifications(deps.db, deps.clock.now())).toEqual([]);
  });

  it('evening reminder once, then never again after it is logged', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    await startChallenge(deps, config());
    deps.clock.at('2026-11-16T20:05');
    const due = await collectDueNotifications(deps.db, deps.clock.now());
    expect(due.map((n) => n.key)).toEqual(['reminder:2026-11-16']);
    await markNotificationSent(deps.db, 'reminder:2026-11-16', deps.clock.now());
    expect(await collectDueNotifications(deps.db, deps.clock.now())).toEqual([]);
  });

  it('celebrates when the target is reached', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    await startChallenge(deps, config({ dailyTarget: 2 }));
    await manual(deps, 'a');
    await manual(deps, 'b');
    const due = await collectDueNotifications(deps.db, deps.clock.now());
    expect(due).toEqual([
      {
        key: 'target-met:2026-11-16',
        title: 'Target met — 1-day streak',
        message: '2 of 2 solved. No virtual penalty today.',
      },
    ]);
  });

  it('announces the finished challenge once', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    const started = await startChallenge(deps, config({ dailyTarget: 1 }));
    deps.clock.at('2026-11-23T07:00');
    await finalizeDueDays(deps);
    const due = await collectDueNotifications(deps.db, deps.clock.now());
    expect(due.map((n) => n.key)).toContain(`challenge:${started.ok ? started.challenge.id : ''}`);
    expect(due.find((n) => n.key.startsWith('challenge:'))?.title).toBe('7-day challenge failed');
  });

  it('respects settings', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    await startChallenge(deps, config());
    await writeSettings(deps.db, {
      ...DEFAULT_SETTINGS,
      notifications: { ...DEFAULT_SETTINGS.notifications, enabled: false },
    });
    deps.clock.at('2026-11-16T23:30');
    expect(await collectDueNotifications(deps.db, deps.clock.now())).toEqual([]);
  });
});

describe('settings', () => {
  it('falls back to defaults when stored settings are corrupt', async () => {
    const deps = makeDeps();
    await deps.db.meta.put({ key: 'settings', value: { theme: 'neon' } });
    expect(await readSettings(deps.db)).toEqual(DEFAULT_SETTINGS);
  });

  it('refuses to write invalid settings', async () => {
    const deps = makeDeps();
    await expect(
      writeSettings(deps.db, {
        ...DEFAULT_SETTINGS,
        notifications: { ...DEFAULT_SETTINGS.notifications, reminderTime: '25:00' },
      }),
    ).rejects.toThrow();
  });
});

describe('badgeFor', () => {
  it('shows remaining problems coloured by urgency, ✓ when done, blank without a target', async () => {
    const deps = makeDeps('2026-11-16T09:00');
    expect(badgeFor(await loadDashboard(deps.db, deps.clock.now()))).toEqual({
      text: '',
      color: '#475569',
    });
    await startChallenge(deps, config({ dailyTarget: 3 }));
    await manual(deps, 'a');
    expect(badgeFor(await loadDashboard(deps.db, deps.clock.now()))).toEqual({
      text: '2',
      color: '#475569',
    });
    deps.clock.at('2026-11-16T19:00');
    expect(badgeFor(await loadDashboard(deps.db, deps.clock.now()))).toEqual({
      text: '2',
      color: '#d97706',
    });
    deps.clock.at('2026-11-16T22:30');
    expect(badgeFor(await loadDashboard(deps.db, deps.clock.now()))).toEqual({
      text: '2',
      color: '#dc2626',
    });
    await manual(deps, 'b');
    await manual(deps, 'c');
    expect(badgeFor(await loadDashboard(deps.db, deps.clock.now()))).toEqual({
      text: '✓',
      color: '#059669',
    });
  });
});
