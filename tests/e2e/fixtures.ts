import { chromium, test as base, type BrowserContext } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const EXTENSION_PATH = path.resolve(import.meta.dirname, '../../.output/chrome-mv3');

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
    // Phase 1 has no service worker; resolve the ID from chrome://extensions.
    const page = await context.newPage();
    await page.goto('chrome://extensions');
    const id = await page.evaluate(async () => {
      const mgmt = (
        globalThis as unknown as {
          chrome: { management: { getAll(): Promise<{ id: string; name: string }[]> } };
        }
      ).chrome.management;
      const all = await mgmt.getAll();
      return all.find((e) => e.name === 'DSA Discipline')?.id;
    });
    await page.close();
    if (!id) throw new Error('DSA Discipline extension did not load');
    await use(id);
  },
});

export const expect = test.expect;
