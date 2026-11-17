import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, kolkataDayStart, readStore, ring, send, test } from './fixtures';

const H = 3_600_000;
const START = {
  planDays: 7,
  dailyTarget: 2,
  startPenaltyRupees: 20,
  incrementRupees: 20,
  countManual: true,
};

async function seed(page: Page) {
  await send(page, { type: 'TEST_SET_CLOCK', nowMs: kolkataDayStart(0) + 9 * H });
  await send(page, { type: 'START_CHALLENGE', input: START });
  await send(page, {
    type: 'ADD_MANUAL_PROBLEM',
    platform: 'leetcode',
    slug: 'two-sum',
    title: 'Two Sum',
  });
}

test('backup → delete everything → restore brings the data back', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html#/settings`);
  await seed(page);

  const backupDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const backupPath = await (await backupDownload).path();
  const backupText = await readFile(backupPath, 'utf8');
  expect(JSON.parse(backupText)).toMatchObject({
    format: 'dsa-discipline-backup',
    schemaVersion: 2,
  });

  const deleteButton = page.getByRole('button', { name: 'Delete all data' });
  await expect(deleteButton).toBeDisabled();
  await page.getByLabel(/Delete all data/).fill('reset');
  await expect(deleteButton).toBeDisabled();
  await page.getByLabel(/Delete all data/).fill('RESET');
  await deleteButton.click();
  await expect(page.getByRole('status')).toHaveText('All data deleted.');
  expect(await readStore(page, 'completions')).toEqual([]);

  await page.getByLabel('Restore from a backup').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backupText.replace('Two Sum', 'Two Sun')),
  });
  await expect(page.getByRole('alert')).toHaveText(
    'The backup is damaged: its checksum does not match.',
  );

  await page.getByLabel('Restore from a backup').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backupText),
  });
  await expect(page.getByText(/with 1 challenges and 1 solved problems/)).toBeVisible();
  const safetyCopy = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Replace my data with this backup' }).click();
  expect((await safetyCopy).suggestedFilename()).toMatch(
    /^dsa-discipline-before-restore-\d{4}-\d{2}-\d{2}\.json$/,
  );
  await expect(page.getByRole('status')).toHaveText('Restored 1 problems, 1 challenges.');

  await page.getByRole('link', { name: 'Today' }).click();
  await expect(ring(page, 1, 2)).toBeVisible();
});

test('worker killed mid-challenge: state survives and missed midnights are caught up on wake', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await seed(page);

  // Stop the worker the way Chrome does when it goes idle (CDP ServiceWorker domain).
  const cdp = await context.newCDPSession(page);
  const status: string[] = [];
  cdp.on('ServiceWorker.workerVersionUpdated', (e) => {
    for (const v of e.versions) status.push(`${v.versionId}:${v.runningStatus}`);
  });
  await cdp.send('ServiceWorker.enable');
  await expect.poll(() => status.length).toBeGreaterThan(0);
  for (const versionId of new Set(status.map((x) => x.split(':')[0] ?? ''))) {
    await cdp.send('ServiceWorker.stopWorker', { versionId });
  }
  await expect.poll(() => status.at(-1)).toMatch(/:stopped$/);

  // Two midnights pass while no worker is running (shift the test clock directly).
  await page.evaluate(
    (offsetTarget) =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open('dsa-discipline');
        open.onsuccess = () => {
          const tx = open.result.transaction('meta', 'readwrite');
          tx.objectStore('meta').put({
            key: 'testClockOffsetMs',
            value: offsetTarget - Date.now(),
          });
          tx.oncomplete = () => {
            resolve();
          };
        };
      }),
    kolkataDayStart(2) + 8 * H,
  );

  // Any message wakes the worker; it must catch up on its own.
  expect(await send(page, { type: 'REFRESH_INTEGRATIONS' })).toMatchObject({ ok: true });
  expect(status.slice(-1)[0]).toMatch(/:running$/);
  await expect.poll(async () => (await readStore(page, 'challengeDays')).length).toBe(2);
  const days = (await readStore(page, 'challengeDays')) as Array<{
    dayIndex: number;
    outcome: string;
  }>;
  expect(days.sort((a, b) => a.dayIndex - b.dayIndex).map((d) => d.outcome)).toEqual([
    'PARTIAL_PENALIZED',
    'ZERO_GRACE',
  ]);
  expect(
    await send(page, {
      type: 'ADD_MANUAL_PROBLEM',
      platform: 'tuf',
      slug: 'bubble-sort',
      title: 'Bubble Sort',
    }),
  ).toMatchObject({ ok: true });
  await expect(ring(page, 1, 2)).toBeVisible();
});

for (const theme of ['dark', 'light'] as const) {
  test(`accessibility: no axe violations on any screen (${theme})`, async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html#/today`);
    const scan = async (where: string) => {
      await page.waitForTimeout(400);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        results.violations.flatMap((v) =>
          v.nodes.map((n) => `${where}: ${v.id} ${n.target.join(' ')} ${n.any[0]?.message ?? ''}`),
        ),
      ).toEqual([]);
    };
    await scan('onboarding');
    await seed(page);
    await send(page, {
      type: 'UPDATE_SETTINGS',
      settings: {
        theme,
        countManualDefault: true,
        notifications: {
          enabled: true,
          reminderTime: '20:00',
          deadlineMinutesBefore: 60,
          targetMet: true,
          dailySummary: false,
        },
      },
    });
    for (const route of ['today', 'challenge', 'history', 'integrations', 'settings']) {
      await page.goto(`chrome-extension://${extensionId}/sidepanel.html#/${route}`);
      await scan(route);
    }
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await scan('popup');
  });
}
