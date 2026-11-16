import { browser } from 'wxt/browser';
import { CommandResultSchema, type Command, type CommandResult } from './contracts';

/** Sends a command to the service worker and validates the reply. */
export async function sendCommand(command: Command): Promise<CommandResult> {
  const reply: unknown = await browser.runtime.sendMessage(command);
  const parsed = CommandResultSchema.safeParse(reply);
  return parsed.success ? parsed.data : { ok: false, error: 'INTERNAL' };
}

const MESSAGES: Record<Exclude<CommandResult, { ok: true }>['error'], string> = {
  FORBIDDEN: 'This action is not allowed.',
  INVALID_COMMAND: 'Some details are not valid. Check the form and try again.',
  ACTIVE_CHALLENGE_EXISTS:
    'You already have an active challenge. It must finish before a new one starts.',
  INVALID_CONFIG: 'Some challenge settings are out of range.',
  INTEGRATION_FAILED: 'The integration could not be updated.',
  INTERNAL: 'Something went wrong in the background. Please try again.',
};

export function describeFailure(result: Exclude<CommandResult, { ok: true }>): string {
  return result.error === 'INTEGRATION_FAILED' && result.issues?.[0] !== undefined
    ? result.issues[0]
    : MESSAGES[result.error];
}
