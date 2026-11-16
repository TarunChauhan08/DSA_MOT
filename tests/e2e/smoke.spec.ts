import { expect, test } from './fixtures';

const DISCLAIMER =
  'Virtual penalty only. No actual money is collected, transferred, owed or donated.';

test('popup renders with disclaimer and dashboard button', async ({ context, extensionId }) => {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(page.getByRole('heading', { name: 'DSA Discipline' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open dashboard' })).toBeEnabled();
  await expect(page.getByText('No challenge yet')).toBeVisible();
  await expect(page.getByRole('note')).toHaveText(DISCLAIMER);
  expect(errors).toEqual([]);
});

test('side panel dashboard navigates between views', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  await expect(page.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page).toHaveURL(/#\/history$/);
  await expect(page.getByText('No history yet')).toBeVisible();

  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('note')).toHaveText(DISCLAIMER);
});

test('options page opens on settings', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByRole('link', { name: 'Settings' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('dark theme is the default', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const scheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
  expect(scheme).toBe('dark');
});
