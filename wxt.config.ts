import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// Manifest permissions are deliberately minimal and added only in the phase
// that first uses them (justification: docs/PHASE_0_PROPOSAL.md §K).
// Phase 1 uses only the side panel. Planned: storage + alarms (Phase 2),
// notifications (Phase 5), leetcode.com + takeuforward.org hosts (Phase 4).
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
    permissions: ['sidePanel'],
    action: { default_title: 'DSA Discipline' },
  },
});
