import { connectLeetCode, disconnectLeetCode, syncLeetCode } from '../application/leetcodeSync';
import { randomIds } from '../application/ports';
import {
  decideMapping,
  finalizeDueDays,
  recordCompletion,
  startChallenge,
  type Deps,
} from '../application/useCases';
import { DEFAULT_TIME_ZONE } from '../domain/calendar';
import type { SourceKey } from '../domain/identity/identity';
import type { FetchFn } from '../integrations/leetcode/client';
import { rupeesToPaise } from '../domain/money';
import {
  CommandSchema,
  CONTENT_SCRIPT_COMMANDS,
  TUF_ORIGIN,
  type CommandResult,
} from '../messaging/contracts';
import { noteSheetOpened, recordSheetTick } from '../application/tufIntake';
import { currentTimeMs, setTestClock } from '../platform/clock';
import type { DsaDatabase } from '../persistence/db';

export interface RouterContext {
  readonly db: DsaDatabase;
  readonly extensionId: string;
  /** e.g. "chrome-extension://<id>/" */
  readonly extensionOrigin: string;
  readonly testClockEnabled: boolean;
  readonly fetchFn: FetchFn;
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
  if (sender.id !== ctx.extensionId) return { ok: false, error: 'FORBIDDEN' };
  const url = sender.url ?? '';
  const fromExtensionPage = url.startsWith(ctx.extensionOrigin);
  const fromTuf = url.startsWith(TUF_ORIGIN);
  if (!fromExtensionPage && !fromTuf) return { ok: false, error: 'FORBIDDEN' };

  const parsed = CommandSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'INVALID_COMMAND',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const command = parsed.data;
  // Content scripts may only report ticks; pages may never impersonate them.
  if (fromTuf !== CONTENT_SCRIPT_COMMANDS.has(command.type))
    return { ok: false, error: 'FORBIDDEN' };

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
    case 'CONNECT_LEETCODE': {
      const result = await connectLeetCode(await depsAt(ctx), ctx.fetchFn, command.username);
      return result.ok
        ? { ok: true, detail: String(result.newSolves) }
        : { ok: false, error: 'INTEGRATION_FAILED', issues: [result.message] };
    }
    case 'DISCONNECT_LEETCODE': {
      await disconnectLeetCode(await depsAt(ctx));
      return { ok: true };
    }
    case 'REFRESH_INTEGRATIONS': {
      const outcome = await syncLeetCode(await depsAt(ctx), ctx.fetchFn, 'on-demand');
      return { ok: true, detail: outcome.status };
    }
    case 'DECIDE_MAPPING': {
      if (command.a === command.b) return { ok: false, error: 'INVALID_COMMAND' };
      await decideMapping(
        await depsAt(ctx),
        command.a as SourceKey,
        command.b as SourceKey,
        command.decision,
      );
      return { ok: true };
    }
    case 'TUF_SHEET_TICK': {
      const result = await recordSheetTick(await depsAt(ctx), {
        slug: command.slug,
        title: command.title,
      });
      return result.status === 'invalid'
        ? { ok: false, error: 'INVALID_COMMAND', issues: [...result.issues] }
        : { ok: true, detail: result.status };
    }
    case 'TUF_SHEET_OPENED': {
      await noteSheetOpened(await depsAt(ctx));
      return { ok: true };
    }
    case 'TEST_SET_CLOCK': {
      if (!ctx.testClockEnabled) return { ok: false, error: 'FORBIDDEN' };
      await setTestClock(ctx.db, command.nowMs);
      await finalizeDueDays(await depsAt(ctx));
      return { ok: true };
    }
  }
}
