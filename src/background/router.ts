import { randomIds } from '../application/ports';
import {
  finalizeDueDays,
  recordCompletion,
  startChallenge,
  type Deps,
} from '../application/useCases';
import { DEFAULT_TIME_ZONE } from '../domain/calendar';
import { rupeesToPaise } from '../domain/money';
import { CommandSchema, type CommandResult } from '../messaging/contracts';
import { currentTimeMs, setTestClock } from '../platform/clock';
import type { DsaDatabase } from '../persistence/db';

export interface RouterContext {
  readonly db: DsaDatabase;
  readonly extensionId: string;
  /** e.g. "chrome-extension://<id>/" */
  readonly extensionOrigin: string;
  readonly testClockEnabled: boolean;
}

export interface SenderInfo {
  readonly id?: string | undefined;
  readonly url?: string | undefined;
}

async function depsAt(ctx: RouterContext): Promise<Deps> {
  const now = await currentTimeMs(ctx.db, ctx.testClockEnabled);
  return { db: ctx.db, clock: { now: () => now }, ids: randomIds };
}

/**
 * The only write path from extension pages into the database. Validates the sender
 * (our own extension pages only) and the message shape before any use case runs.
 */
export async function handleCommand(
  ctx: RouterContext,
  raw: unknown,
  sender: SenderInfo,
): Promise<CommandResult> {
  if (sender.id !== ctx.extensionId || !(sender.url ?? '').startsWith(ctx.extensionOrigin)) {
    return { ok: false, error: 'FORBIDDEN' };
  }
  const parsed = CommandSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'INVALID_COMMAND',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const command = parsed.data;

  switch (command.type) {
    case 'START_CHALLENGE': {
      const { input } = command;
      const result = await startChallenge(await depsAt(ctx), {
        planDays: input.planDays,
        dailyTarget: input.dailyTarget,
        startPenaltyPaise: rupeesToPaise(input.startPenaltyRupees),
        incrementPaise: rupeesToPaise(input.incrementRupees),
        timeZone: DEFAULT_TIME_ZONE,
        countManual: input.countManual,
      });
      if (result.ok) return { ok: true, detail: result.challenge.id };
      return result.reason === 'INVALID_CONFIG'
        ? { ok: false, error: 'INVALID_CONFIG', issues: result.issues.map((i) => i.message) }
        : { ok: false, error: 'ACTIVE_CHALLENGE_EXISTS' };
    }
    case 'ADD_MANUAL_PROBLEM': {
      const result = await recordCompletion(await depsAt(ctx), {
        evidence: 'USER_MANUAL',
        platform: command.platform,
        slug: command.slug,
        title: command.title,
      });
      return result.status === 'invalid'
        ? { ok: false, error: 'INVALID_COMMAND', issues: [...result.issues] }
        : { ok: true, detail: result.id };
    }
    case 'TEST_SET_CLOCK': {
      if (!ctx.testClockEnabled) return { ok: false, error: 'FORBIDDEN' };
      await setTestClock(ctx.db, command.nowMs);
      await finalizeDueDays(await depsAt(ctx));
      return { ok: true };
    }
  }
}
