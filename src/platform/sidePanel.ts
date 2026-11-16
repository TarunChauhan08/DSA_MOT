import { browser } from 'wxt/browser';

/**
 * Opens the dashboard side panel for the current window.
 * Must be called from a user gesture (e.g. a click in the popup).
 */
export async function openDashboardSidePanel(): Promise<void> {
  const current = await browser.windows.getCurrent();
  if (current.id === undefined) {
    throw new Error('Could not determine the current browser window.');
  }
  await browser.sidePanel.open({ windowId: current.id });
}
