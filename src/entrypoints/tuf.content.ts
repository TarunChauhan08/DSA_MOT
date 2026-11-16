import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { observeSheet } from '../integrations/tuf/sheetDetector';
import type { Command } from '../messaging/contracts';

/**
 * Watches the Striver A2Z sheet for ticks and reports them to the service worker.
 * Reads only checkbox state and problem links; never touches storage or the page's data.
 */
export default defineContentScript({
  matches: ['https://takeuforward.org/*'],
  runAt: 'document_idle',
  main() {
    const send = (command: Command) => {
      browser.runtime.sendMessage(command).catch((error: unknown) => {
        console.warn('[dsa] could not reach the extension', error);
      });
    };
    send({ type: 'TUF_SHEET_OPENED' });
    observeSheet(document, (problem) => {
      send({ type: 'TUF_SHEET_TICK', slug: problem.slug, title: problem.title });
    });
  },
});
