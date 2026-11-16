import type { Page } from '@playwright/test';
import { expect, kolkataDayStart, send, test } from './fixtures';

async function setDay(page: Page, dayOffset: number) {
  expect(await send(page, { type: 'TEST_SET_CLOCK', nowMs: kolkataDayStart(dayOffset) })).toEqual({
    ok: true,
  });
}

async function addProblems(page: Page, names: string[]) {
  for (const name of names) {
    const input = page.getByRole('textbox', { name: /Paste a LeetCode/ });
    await input.fill(name);
    await page.getByRole('button', { name: 'Add problem' }).click();
    await expect(input).toHaveValue(''); // cleared only after the service worker accepted it
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
}

test('full 7-day challenge lifecycle with grace, partial, missed days and late finish', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const solved = page.getByLabel('Solved today');

  await test.step('onboarding → setup → confirm → start', async () => {
    await page.getByRole('link', { name: 'Set up your first challenge' }).click();
    await page.getByRole('radio', { name: /7 days/ }).check();
    await page.getByLabel('Daily target').fill('4');
    await page.getByRole('button', { name: 'Review challenge' }).click();
    await expect(page.getByText('Once started, these settings are locked')).toBeVisible();
    await page.getByRole('button', { name: 'Start challenge' }).click();
    await expect(page).toHaveURL(/#\/today$/);
    await expect(solved).toHaveText('0 / 4');
    await expect(page.getByText(/uses a grace day/)).toBeVisible();
  });

  await test.step('day 1: complete the target (one duplicate is not counted)', async () => {
    await addProblems(page, [
      'https://leetcode.com/problems/two-sum/',
      'Valid Anagram',
      'Merge Intervals',
    ]);
    await addProblems(page, ['https://leetcode.com/problems/two-sum/']);
    await expect(solved).toHaveText('3 / 4');
    await expect(page.getByText('If the day ended now: ₹5 virtual penalty.')).toBeVisible();
    await expect(page.getByText('Duplicate — not counted')).toBeVisible();
    await addProblems(page, ['https://takeuforward.org/practice/dsa/selection-sort']);
    await expect(solved).toHaveText('4 / 4');
    await expect(page.getByText('Target met — no virtual penalty today.')).toBeVisible();
  });

  await test.step('day 2: rolls over at midnight; partial day', async () => {
    await setDay(page, 1);
    await expect(solved).toHaveText('0 / 4');
    await expect(page.getByText('1 day streak')).toBeVisible();
    await addProblems(page, ['Two Sum']); // re-solving on a new day counts again
    await addProblems(page, ['Three Sum']);
    await expect(page.getByText('If the day ended now: ₹10 virtual penalty.')).toBeVisible();
  });

  await test.step('days 3–5: grace, grace, then missed after grace runs out', async () => {
    await setDay(page, 5); // days 3, 4 and 5 pass with nothing solved
    await page.getByRole('link', { name: 'Challenge' }).click();
    const rows = page.getByRole('row');
    await expect(rows.nth(1)).toContainText('Target met');
    await expect(rows.nth(2)).toContainText('Partial');
    await expect(rows.nth(2)).toContainText('₹10');
    await expect(rows.nth(3)).toContainText('Grace day');
    await expect(rows.nth(4)).toContainText('Grace day');
    await expect(rows.nth(5)).toContainText('Missed');
    await expect(rows.nth(5)).toContainText('₹40');
    await expect(rows.nth(6)).toContainText('Today');
    await expect(page.getByText('Locked')).toBeVisible();
  });

  await test.step('the challenge cannot be edited, quit or doubled', async () => {
    await page.getByRole('link', { name: 'Today' }).click();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html#/setup`);
    await expect(page.getByText('A challenge is already running')).toBeVisible();
    const startAgain = {
      type: 'START_CHALLENGE',
      input: {
        planDays: 7,
        dailyTarget: 1,
        startPenaltyRupees: 0,
        incrementRupees: 0,
        countManual: true,
      },
    };
    expect(await send(page, startAgain)).toEqual({ ok: false, error: 'ACTIVE_CHALLENGE_EXISTS' });
    expect(await send(page, { type: 'UPDATE_CHALLENGE', input: startAgain.input })).toMatchObject({
      ok: false,
      error: 'INVALID_COMMAND',
    });
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html#/today`);
    await expect(page.getByText('This challenge can no longer pass.')).toBeVisible();
  });

  await test.step('after the last day the challenge is FAILED with the full ledger', async () => {
    await setDay(page, 7);
    await expect(page.getByText('No active challenge')).toBeVisible();
    await page.getByRole('link', { name: 'History' }).click();
    await expect(page.getByText('Failed')).toBeVisible();
    // ₹10 (day 2) + ₹40 (day 5) + ₹60 (day 6) + ₹80 (day 7) = ₹190
    await expect(page.getByText(/1\/5 full days · ₹190/)).toBeVisible();
  });

  await test.step('a new challenge can start once the previous one ended', async () => {
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html#/setup`);
    await expect(page.getByRole('button', { name: 'Review challenge' })).toBeVisible();
  });
});

test('popup shows today, grace and potential penalty for an active challenge', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  expect(
    await send(page, {
      type: 'START_CHALLENGE',
      input: {
        planDays: 15,
        dailyTarget: 3,
        startPenaltyRupees: 30,
        incrementRupees: 10,
        countManual: true,
      },
    }),
  ).toMatchObject({ ok: true });
  expect(
    await send(page, {
      type: 'ADD_MANUAL_PROBLEM',
      platform: 'tuf',
      slug: 'bubble-sort',
      title: 'Bubble Sort',
    }),
  ).toMatchObject({ ok: true });

  await expect(page.getByLabel('Solved today')).toHaveText('1 / 3');
  await expect(page.getByText('Day 1 of 15 · 3 grace days left · 0/12 full days')).toBeVisible();
  // 1/3 on the first penalized day: ₹30 × 2/3 = ₹20.
  await expect(page.getByText('If the day ended now: ₹20 virtual penalty.')).toBeVisible();
  await expect(page.getByRole('note')).toContainText('Virtual penalty only.');
});
