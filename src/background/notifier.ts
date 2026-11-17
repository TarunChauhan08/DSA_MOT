import { browser } from 'wxt/browser';
import { badgeFor, collectDueNotifications, markNotificationSent } from '../application/notify';
import { loadDashboard } from '../application/queries';
import { readSettings } from '../application/settings';
import { DEFAULT_TIME_ZONE } from '../domain/calendar';
import { nextNotificationCheckMs } from '../domain/notifications/planner';
import type { DsaDatabase } from '../persistence/db';

export const NOTIFY_ALARM = 'dsa:notify';
const BADGE_TEXT_COLOR = '#ffffff';

/** Sends every due notification once (logged in notificationLog). */
export async function sendDueNotifications(db: DsaDatabase, nowMs: number): Promise<void> {
  for (const n of await collectDueNotifications(db, nowMs)) {
    await browser.notifications.create(n.key, {
      type: 'basic',
      iconUrl: browser.runtime.getURL('/icon/128.png'),
      title: n.title,
      message: n.message,
      priority: n.key.startsWith('deadline:') ? 2 : 0,
    });
    await markNotificationSent(db, n.key, nowMs);
  }
}

export async function refreshBadge(db: DsaDatabase, nowMs: number): Promise<void> {
  const badge = badgeFor(await loadDashboard(db, nowMs));
  await browser.action.setBadgeText({ text: badge.text });
  await browser.action.setBadgeBackgroundColor({ color: badge.color });
  await browser.action.setBadgeTextColor({ color: BADGE_TEXT_COLOR });
}

export async function scheduleNotificationAlarm(db: DsaDatabase, nowMs: number): Promise<void> {
  const settings = await readSettings(db);
  const when = nextNotificationCheckMs(nowMs, DEFAULT_TIME_ZONE, settings.notifications);
  if (when === null) await browser.alarms.clear(NOTIFY_ALARM);
  else await browser.alarms.create(NOTIFY_ALARM, { when });
}

/** Clicking any notification opens the dashboard on Today. */
export function openDashboardOnClick(): void {
  browser.notifications.onClicked.addListener((id) => {
    void browser.notifications.clear(id);
    void browser.tabs.create({ url: browser.runtime.getURL('/sidepanel.html#/today') });
  });
}
