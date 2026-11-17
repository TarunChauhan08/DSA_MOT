import { z } from 'zod';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../domain/notifications/planner';
import type { DsaDatabase } from '../persistence/db';

const MAX_DEADLINE_MINUTES = 180;

export const SettingsSchema = z
  .object({
    theme: z.enum(['dark', 'light', 'system']),
    /** Default for the "count manual entries" switch when setting up a new challenge. */
    countManualDefault: z.boolean(),
    notifications: z
      .object({
        enabled: z.boolean(),
        reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        deadlineMinutesBefore: z.number().int().min(0).max(MAX_DEADLINE_MINUTES),
        targetMet: z.boolean(),
        dailySummary: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  countManualDefault: true,
  notifications: DEFAULT_NOTIFICATION_SETTINGS,
};

export const SETTINGS_META_KEY = 'settings';

export async function readSettings(db: DsaDatabase): Promise<Settings> {
  const stored = (await db.meta.get(SETTINGS_META_KEY))?.value;
  if (stored === undefined) return DEFAULT_SETTINGS;
  const parsed = SettingsSchema.safeParse(stored);
  if (!parsed.success) {
    console.warn('[dsa] stored settings invalid; using defaults', parsed.error.issues);
    return DEFAULT_SETTINGS;
  }
  return parsed.data;
}

export async function writeSettings(db: DsaDatabase, settings: Settings): Promise<void> {
  await db.meta.put({ key: SETTINGS_META_KEY, value: SettingsSchema.parse(settings) });
}
