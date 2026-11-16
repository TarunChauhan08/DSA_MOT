import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// Manifest permissions are deliberately minimal and added only in the phase
// that first uses them (justification: docs/PHASE_0_PROPOSAL.md §K).
// sidePanel: dashboard. alarms: midnight day-close + 30-min catch-up sweep (Phase 3).
// leetcode.com host: the username-based public GraphQL check (ADR-0004), no cookies.
// takeuforward.org access comes only from the content script's `matches` (Phase 4).
// Planned: notifications (Phase 5). IndexedDB needs no permission.
// tests/unit/manifest.test.ts fails if this list changes unreviewed.
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'DSA Discipline',
    description:
      'Daily DSA accountability across LeetCode and Striver A2Z. Virtual penalty only — no real money.',
    minimum_chrome_version: '116',
    permissions: ['sidePanel', 'alarms'],
    host_permissions: ['https://leetcode.com/*'],
    action: { default_title: 'DSA Discipline' },
  },
});
