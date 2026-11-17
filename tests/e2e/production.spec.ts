import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { expect, PRODUCTION_PATH, send, test } from './fixtures';

test.use({ extensionPath: PRODUCTION_PATH });

test('release build: loads, renders, and refuses the test clock', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.getByText('No challenge yet')).toBeVisible();
  expect(await send(page, { type: 'TEST_SET_CLOCK', nowMs: 0 })).toEqual({
    ok: false,
    error: 'FORBIDDEN',
  });
  expect(errors).toEqual([]);
});

async function sizeOf(dir: string, ext: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && entry.name.endsWith(ext))
      total += (await stat(path.join(entry.parentPath, entry.name))).size;
  }
  return total;
}

/**
 * Regression guard, calibrated 2026-11-18 at 704 KiB JS (React DOM, Dexie, Zod ≈ 85%).
 * Loaded from local disk, so speed is checked separately below. Shrinking further
 * means moving to zod/mini (docs/ROADMAP.md).
 */
test('release build stays within the size budget', async () => {
  const KB = 1024;
  expect(await sizeOf(PRODUCTION_PATH, '.js')).toBeLessThan(800 * KB);
  expect(await sizeOf(PRODUCTION_PATH, '.css')).toBeLessThan(60 * KB);
  expect(await sizeOf(PRODUCTION_PATH, '.woff2')).toBeLessThan(220 * KB);
});

test('popup shows content quickly', async ({ context, extensionId }) => {
  const page = await context.newPage();
  const started = Date.now();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.getByText('No challenge yet')).toBeVisible();
  expect(Date.now() - started).toBeLessThan(1500);
});
