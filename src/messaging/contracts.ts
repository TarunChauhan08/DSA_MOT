import { z } from 'zod';
import { MAX_DAILY_TARGET } from '../domain/challenge/config';
import { isValidSlug } from '../domain/identity/identity';
import { SettingsSchema } from '../application/settings';

/** Generous: a year of daily practice is well under 1 MB. */
export const MAX_BACKUP_CHARS = 20_000_000;

/** Whole rupees; converted to paise in the service worker. */
const MAX_PENALTY_RUPEES = 100_000;
const rupees = z.number().int().min(0).max(MAX_PENALTY_RUPEES);

export const StartChallengeInputSchema = z
  .object({
    planDays: z.union([z.literal(7), z.literal(15), z.literal(30)]),
    dailyTarget: z.number().int().min(1).max(MAX_DAILY_TARGET),
    startPenaltyRupees: rupees,
    incrementRupees: rupees,
    countManual: z.boolean(),
  })
  .strict();

export type StartChallengeInput = z.infer<typeof StartChallengeInputSchema>;

/**
 * Every command an extension page may send. There is intentionally no command to
 * edit or quit a challenge: a started challenge is frozen (PRD §3, ADR-0007).
 */
export const CommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('START_CHALLENGE'), input: StartChallengeInputSchema }).strict(),
  z
    .object({
      type: z.literal('ADD_MANUAL_PROBLEM'),
      platform: z.enum(['leetcode', 'tuf']),
      slug: z.string().refine(isValidSlug),
      title: z.string().trim().min(1).max(200),
    })
    .strict(),
  z.object({ type: z.literal('CONNECT_LEETCODE'), username: z.string().max(60) }).strict(),
  z.object({ type: z.literal('DISCONNECT_LEETCODE') }).strict(),
  z.object({ type: z.literal('UPDATE_SETTINGS'), settings: SettingsSchema }).strict(),
  /** The worker re-validates the file itself; the page's preview is never trusted. */
  z
    .object({ type: z.literal('IMPORT_BACKUP'), json: z.string().min(2).max(MAX_BACKUP_CHARS) })
    .strict(),
  z.object({ type: z.literal('RESET_DATA'), confirmation: z.literal('RESET') }).strict(),
  /** Popup/dashboard opened: check integrations now (debounced in the worker). */
  z.object({ type: z.literal('REFRESH_INTEGRATIONS') }).strict(),
  z
    .object({
      type: z.literal('DECIDE_MAPPING'),
      a: z.string().regex(/^(lc|tuf):[a-z0-9-]{1,200}$/),
      b: z.string().regex(/^(lc|tuf):[a-z0-9-]{1,200}$/),
      decision: z.enum(['SAME', 'DIFFERENT']),
    })
    .strict(),
  /** From the takeUforward content script only. */
  z
    .object({
      type: z.literal('TUF_SHEET_TICK'),
      slug: z.string().refine(isValidSlug),
      title: z.string().trim().min(1).max(200),
    })
    .strict(),
  z.object({ type: z.literal('TUF_SHEET_OPENED') }).strict(),
  /** Only honoured in the e2e test build. */
  z.object({ type: z.literal('TEST_SET_CLOCK'), nowMs: z.number().int().nonnegative() }).strict(),
]);

export type Command = z.infer<typeof CommandSchema>;

export const CommandResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), detail: z.string().optional() }),
  z.object({
    ok: z.literal(false),
    error: z.enum([
      'FORBIDDEN',
      'INVALID_COMMAND',
      'ACTIVE_CHALLENGE_EXISTS',
      'INVALID_CONFIG',
      'INTEGRATION_FAILED',
      'BACKUP_REJECTED',
      'BACKUP_DUPLICATE',
      'INTERNAL',
    ]),
    issues: z.array(z.string()).optional(),
  }),
]);

export type CommandResult = z.infer<typeof CommandResultSchema>;

/** Commands a takeUforward content script may send; everything else is extension-pages only. */
export const CONTENT_SCRIPT_COMMANDS: ReadonlySet<Command['type']> = new Set([
  'TUF_SHEET_TICK',
  'TUF_SHEET_OPENED',
]);
export const TUF_ORIGIN = 'https://takeuforward.org/';
