import type { Page } from '@playwright/test';
import { expect, kolkataDayStart, send, test } from './fixtures';

const H = 3_600_000;

/** Reads notification log keys straight from the extension's IndexedDB. */
function notificationKeys(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open('dsa-discipline');
        open.onerror = () => {
          reject(new Error('open failed'));
        };
        open.onsuccess = () => {
          const req = open.result
            .transaction('notificationLog')
            .objectStore('notificationLog')
            .getAllKeys();
          req.onsuccess = () => {
            resolve(req.result.map(String));
          };
        };
      }),
  );
}

async function badge(page: Page) {
  return page.evaluate(async () => {
    const action = (
      globalThis as unknown as {
        chrome: {
          action: {
            getBadgeText(d: object): Promise<string>;
            getBadgeBackgroundColor(d: object): Promise<number[]>;
          };
        };
      }
    ).chrome.action;
    return { text: await action.getBadgeText({}), color: await action.getBadgeBackgroundColor({}) };
  });
}

test('evening reminder fires once, badge shows remaining problems by urgency', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await send(page, { type: 'TEST_SET_CLOCK', nowMs: kolkataDayStart(0) + 9 * H });
  await send(page, {
    type: 'START_CHALLENGE',
    input: {
      planDays: 7,
      dailyTarget: 2,
      startPenaltyRupees: 20,
      incrementRupees: 20,
      countManual: true,
    },
  });
  await expect.poll(() => badge(page)).toEqual({ text: '2', color: [71, 85, 105, 255] }); // calm slate
  expect(await notificationKeys(page)).toEqual([]);

  await send(page, { type: 'TEST_SET_CLOCK', nowMs: kolkataDayStart(0) + 20 * H + 5 * 60_000 });
  await expect.poll(() => notificationKeys(page)).toEqual([expect.stringMatching(/^reminder:/)]);
  await expect.poll(() => badge(page)).toEqual({ text: '2', color: [217, 119, 6, 255] }); // amber

  await send(page, { type: 'TEST_SET_CLOCK', nowMs: kolkataDayStart(0) + 20 * H + 30 * 60_000 });
  expect((await notificationKeys(page)).filter((k) => k.startsWith('reminder:'))).toHaveLength(1);

  await send(page, { type: 'ADD_MANUAL_PROBLEM', platform: 'leetcode', slug: 'a', title: 'A' });
  await send(page, { type: 'ADD_MANUAL_PROBLEM', platform: 'leetcode', slug: 'b', title: 'B' });
  await expect.poll(() => badge(page)).toEqual({ text: '✓', color: [5, 150, 105, 255] });
  await expect
    .poll(() => notificationKeys(page))
    .toContainEqual(expect.stringMatching(/^target-met:/));
});

test('settings persist and the theme applies everywhere', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html#/settings`);
  await page.getByRole('radio', { name: 'Light' }).click();
  await page.getByRole('switch', { name: /Morning summary/ }).click();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('status')).toHaveText('Settings saved.');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.getByRole('switch', { name: /Morning summary/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('history shows the heatmap, rates, ledger and trend from real data', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await send(page, { type: 'TEST_SET_CLOCK', nowMs: kolkataDayStart(0) + 9 * H });
  await send(page, {
    type: 'START_CHALLENGE',
    input: {
      planDays: 7,
      dailyTarget: 4,
      startPenaltyRupees: 20,
      incrementRupees: 20,
      countManual: true,
    },
  });
  for (let i = 0; i < 3; i += 1)
    await send(page, {
      type: 'ADD_MANUAL_PROBLEM',
      platform: 'leetcode',
      slug: `p${String(i)}`,
      title: 'P',
    });
  await send(page, { type: 'TEST_SET_CLOCK', nowMs: kolkataDayStart(1) + 9 * H });
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html#/history`);
  await expect(page.getByRole('grid', { name: 'Daily practice heatmap' })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: /3 solved of 4/ })).toBeVisible();
  await expect(page.getByText('0%')).toHaveCount(2); // 0 of 1 day, last 7 and last 30
  await expect(
    page.getByRole('img', { name: /Virtual penalty over the last 1 challenge days/ }),
  ).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: '7-day challenge' })).toContainText(
    '₹5',
  );
});
