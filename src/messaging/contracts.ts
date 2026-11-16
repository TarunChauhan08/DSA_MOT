import { z } from 'zod';
import { MAX_DAILY_TARGET } from '../domain/challenge/config';
import { isValidSlug } from '../domain/identity/identity';

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
      'INTERNAL',
    ]),
    issues: z.array(z.string()).optional(),
  }),
]);

export type CommandResult = z.infer<typeof CommandResultSchema>;
