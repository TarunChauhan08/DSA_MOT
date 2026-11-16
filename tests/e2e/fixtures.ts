import { chromium, test as base, type BrowserContext, type Page } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** The e2e build (`wxt build --mode e2e`) is the only one that honours the test clock. */
const EXTENSION_PATH = path.resolve(import.meta.dirname, '../../.output/chrome-mv3-e2e');

/**
 * Loads the built, unpacked extension into a fresh Chromium profile.
 * Branded Google Chrome ignores --load-extension since v137, so this uses
 * Playwright's Chromium, or a Chrome for Testing binary via CHROME_PATH.
 */
export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  context: async ({}, use) => {
    const userDataDir = mkdtempSync(path.join(tmpdir(), 'dsa-discipline-e2e-'));
    const executablePath = process.env.CHROME_PATH;
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      ...(executablePath ? { executablePath } : {}),
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const id = new URL(worker.url()).host;
    if (!id) throw new Error('DSA Discipline extension did not load');
    await use(id);
  },
});

export const expect = test.expect;

/** Sends a command to the service worker from an extension page. */
export async function send(page: Page, command: unknown): Promise<unknown> {
  return page.evaluate(
    (cmd) =>
      (
        globalThis as unknown as {
          chrome: { runtime: { sendMessage(m: unknown): Promise<unknown> } };
        }
      ).chrome.runtime.sendMessage(cmd),
    command,
  );
}

/** Epoch ms for 00:01 IST, `days` after today's date in Asia/Kolkata. */
export function kolkataDayStart(days: number): number {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(Date.now());
  return Date.parse(`${today}T00:01:00+05:30`) + days * 86_400_000;
}
