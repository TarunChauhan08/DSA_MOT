import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { randomIds } from '../application/ports';
import { syncLeetCode } from '../application/leetcodeSync';
import { finalizeDueDays } from '../application/useCases';
import { handleCommand } from '../background/router';
import {
  openDashboardOnClick,
  refreshBadge,
  scheduleNotificationAlarm,
  sendDueNotifications,
} from '../background/notifier';
import { scheduleAlarms } from '../background/scheduler';
import { currentTimeMs } from '../platform/clock';
import { TEST_CLOCK_ENABLED } from '../platform/env';
import { DsaDatabase } from '../persistence/db';

export default defineBackground(() => {
  const db = new DsaDatabase();
  const ctx = {
    db,
    extensionId: browser.runtime.id,
    extensionOrigin: browser.runtime.getURL('/'),
    testClockEnabled: TEST_CLOCK_ENABLED,
    fetchFn: (url: string, init: RequestInit) => fetch(url, init),
  };

  /** Badge, due notifications and the next reminder alarm, after any change or wake-up. */
  const afterChange = async (now: number) => {
    await refreshBadge(db, now);
    await sendDueNotifications(db, now);
    await scheduleNotificationAlarm(db, now);
  };

  // Never rely on the worker staying alive: catch up on every wake-up (ADR-0005).
  const catchUp = async (trigger: string) => {
    const now = await currentTimeMs(db, TEST_CLOCK_ENABLED);
    const deps = { db, clock: { now: () => now }, ids: randomIds };
    const report = await finalizeDueDays(deps);
    await scheduleAlarms(now);
    const sync = await syncLeetCode(deps, ctx.fetchFn, 'schedule');
    if (sync.status === 'error') console.warn('[dsa] LeetCode check failed', sync.error);
    await afterChange(now);
    if (report.finalized + report.revised + report.completed > 0) {
      console.info(`[dsa] catch-up (${trigger})`, report);
    }
  };
  const runCatchUp = (trigger: string) => {
    catchUp(trigger).catch((error: unknown) => {
      console.error(`[dsa] catch-up failed (${trigger})`, error);
    });
  };

  browser.runtime.onInstalled.addListener(() => {
    runCatchUp('installed');
  });
  browser.runtime.onStartup.addListener(() => {
    runCatchUp('startup');
  });
  browser.alarms.onAlarm.addListener((alarm) => {
    runCatchUp(alarm.name);
  });
  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    handleCommand(ctx, message, sender)
      .then(async (result) => {
        sendResponse(result);
        if (result.ok) await afterChange(await currentTimeMs(db, TEST_CLOCK_ENABLED));
      })
      .catch((error: unknown) => {
        console.error('[dsa] command failed', error);
        sendResponse({ ok: false, error: 'INTERNAL' });
      });
    return true; // keep the channel open for the async response
  });

  openDashboardOnClick();
  runCatchUp('wake');
});
