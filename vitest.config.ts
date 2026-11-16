import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/application/**', 'src/persistence/**'],
      exclude: ['**/*.md'],
      reporter: ['text', 'html'],
      // Phase 2 acceptance: domain ≥ 95% (docs/PHASE_0_PROPOSAL.md §M).
      thresholds: { 'src/domain/**': { lines: 95, branches: 90, functions: 95, statements: 95 } },
    },
  },
});
