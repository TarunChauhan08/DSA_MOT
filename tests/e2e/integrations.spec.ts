import type { BrowserContext } from '@playwright/test';
import { expect, send, test } from './fixtures';

const nowSeconds = () => String(Math.floor(Date.now() / 1000) - 60);

async function fakeLeetCode(context: BrowserContext, opts: { userExists: boolean }) {
  const requests: { body: string; cookie: string | undefined }[] = [];
  await context.route('https://leetcode.com/graphql/**', async (route) => {
    const req = route.request();
    requests.push({ body: req.postData() ?? '', cookie: (await req.allHeaders()).cookie });
    const isRecent = (req.postData() ?? '').includes('recentAcSubmissionList');
    const user = opts.userExists ? { username: 'tarunchauhan199908' } : null;
    const data = isRecent
      ? {
          matchedUser: user,
          recentAcSubmissionList: opts.userExists
            ? [
                {
                  id: '1903120001',
                  title: 'Two Sum',
                  titleSlug: 'two-sum',
                  timestamp: nowSeconds(),
                },
              ]
            : null,
        }
      : {
          matchedUser: user && {
            submitStatsGlobal: {
              acSubmissionNum: [
                { difficulty: 'All', count: 58 },
                { difficulty: 'Easy', count: 23 },
                { difficulty: 'Medium', count: 34 },
                { difficulty: 'Hard', count: 1 },
              ],
            },
          },
        };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data }),
    });
  });
  return requests;
}

// Rows use the exact attributes recorded from the live sheet on 2026-11-16.
const SHEET_HTML = `<!doctype html><html><body>
<table><tbody>
<tr data-row-type="practice" data-sheet-row-key="practice-17136"><td>
<button role="checkbox" aria-checked="false" data-state="unchecked" aria-label="Mark Breaking The Myth complete"></button></td>
<td><a href="/blogs/data-structure-and-algorithm/breaking-the-myth">read</a></td></tr>
<tr data-row-type="practice" data-sheet-row-key="practice-947"><td>
<button role="checkbox" aria-checked="false" data-state="unchecked" aria-label="Mark Selection Sort complete"></button></td>
<td><a href="https://takeuforward.org/practice/dsa/selection-sort">solve</a></td></tr>
</tbody></table>
<script>
document.querySelectorAll('[role=checkbox]').forEach((b) => b.addEventListener('click', () => {
  const on = b.getAttribute('aria-checked') !== 'true';
  b.setAttribute('aria-checked', String(on));
  b.setAttribute('data-state', on ? 'checked' : 'unchecked');
}));
</script></body></html>`;

test.beforeEach(async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await send(page, {
    type: 'START_CHALLENGE',
    input: {
      planDays: 7,
      dailyTarget: 3,
      startPenaltyRupees: 20,
      incrementRupees: 20,
      countManual: true,
    },
  });
  await page.close();
});

test('connect LeetCode by username: verified solve counts, stats card shows, no cookies sent', async ({
  context,
  extensionId,
}) => {
  const requests = await fakeLeetCode(context, { userExists: true });
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html#/integrations`);
  await expect(page.getByText('Not connected')).toBeVisible();

  await page.getByLabel('LeetCode username').fill('tarunchauhan199908');
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.getByText('Active', { exact: true })).toBeVisible();
  await expect(page.getByText('tarunchauhan199908')).toBeVisible();
  await expect(page.getByText('58')).toBeVisible(); // stats card
  expect(requests.length).toBeGreaterThanOrEqual(2);
  for (const r of requests) expect(r.cookie).toBeUndefined();

  await page.getByRole('link', { name: 'Today' }).click();
  await expect(page.getByLabel('Solved today')).toHaveText('1 / 3');
  await expect(page.getByText('Verified')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Two Sum' })).toHaveAttribute(
    'href',
    'https://leetcode.com/problems/two-sum/',
  );

  await page.getByRole('link', { name: 'Integrations' }).click();
  await page.getByRole('button', { name: 'Check now' }).click();
  await expect(page.getByText(/Checked moments ago/)).toBeVisible(); // 2-minute debounce

  await page.getByRole('button', { name: 'Disconnect' }).click();
  await expect(page.getByText('Not connected')).toBeVisible();
});

test('unknown LeetCode username is rejected with a clear message', async ({
  context,
  extensionId,
}) => {
  await fakeLeetCode(context, { userExists: false });
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html#/integrations`);
  await page.getByLabel('LeetCode username').fill('no-such-user-xyz');
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.getByRole('alert')).toHaveText('LeetCode has no user with that username.');
  await expect(page.getByText('Not connected')).toBeVisible();
});

test('ticking a problem on the Striver sheet counts as "Sheet marked"; theory lessons do not', async ({
  context,
  extensionId,
}) => {
  await context.route('https://takeuforward.org/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: SHEET_HTML }),
  );
  const sheet = await context.newPage();
  await sheet.goto('https://takeuforward.org/prep-hub/strivers-a2z-dsa-sheet');
  await sheet.waitForTimeout(500); // content script runs at document_idle
  await sheet.getByRole('checkbox', { name: 'Mark Breaking The Myth complete' }).click();
  await sheet.getByRole('checkbox', { name: 'Mark Selection Sort complete' }).click();

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(page.getByLabel('Solved today')).toHaveText('1 / 3');
  await expect(page.getByText('Sheet marked')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Selection Sort' })).toHaveAttribute(
    'href',
    'https://takeuforward.org/practice/dsa/selection-sort',
  );

  await page.getByRole('link', { name: 'Integrations' }).click();
  await expect(page.getByText(/Last tick detected/)).toBeVisible();
});

test('a same-named problem from both platforms can be merged into one', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await send(page, {
    type: 'ADD_MANUAL_PROBLEM',
    platform: 'leetcode',
    slug: 'two-sum',
    title: 'Two Sum',
  });
  await send(page, {
    type: 'ADD_MANUAL_PROBLEM',
    platform: 'tuf',
    slug: 'two-sum-problem',
    title: 'Two Sum',
  });
  await expect(page.getByLabel('Solved today')).toHaveText('2 / 3');
  await expect(page.getByText('Same problem on both platforms?')).toBeVisible();
  await page.getByRole('button', { name: 'Same problem' }).click();
  await expect(page.getByLabel('Solved today')).toHaveText('1 / 3');
  await expect(page.getByText('Same problem on both platforms?')).toHaveCount(0);
});
