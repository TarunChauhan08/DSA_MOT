import { browser } from 'wxt/browser';
import { addDays, dayKeyOf, DEFAULT_TIME_ZONE, startOfDayMs } from '../domain/calendar';

export const MIDNIGHT_ALARM = 'dsa:midnight';
export const SWEEP_ALARM = 'dsa:sweep';
/** Backup catch-up in case a midnight alarm is delayed or lost (Chrome alarms are best-effort). */
const SWEEP_PERIOD_MINUTES = 30;
const AFTER_MIDNIGHT_MS = 5_000;

export function nextMidnightMs(nowMs: number, timeZone: string = DEFAULT_TIME_ZONE): number {
  return startOfDayMs(addDays(dayKeyOf(nowMs, timeZone), 1), timeZone) + AFTER_MIDNIGHT_MS;
}

/** Re-created on every service-worker start; alarms may not survive a browser restart. */
export async function scheduleAlarms(nowMs: number): Promise<void> {
  await browser.alarms.create(MIDNIGHT_ALARM, { when: nextMidnightMs(nowMs) });
  const sweep = await browser.alarms.get(SWEEP_ALARM);
  if (sweep === undefined) {
    await browser.alarms.create(SWEEP_ALARM, { periodInMinutes: SWEEP_PERIOD_MINUTES });
  }
}
