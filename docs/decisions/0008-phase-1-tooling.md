# ADR-0008: Phase 1 tooling choices

Status: Accepted (implemented 2026-11-16)

1. **npm, not pnpm.** Node 22 + npm ship with every setup; no extra tool to install on Windows. `package-lock.json` is committed and `npm ci` is used everywhere.
2. **Permissions are added in the phase that first uses them.** Phase 1 manifest requests only `sidePanel`. `tests/unit/manifest.test.ts` pins the list so any change is deliberate.
3. **No router library.** Six hash routes are handled by a 30-line typed parser (`src/ui/routing`), so options/side panel can deep-link (`#/settings`).
4. **No component library yet.** Four primitives (Button, EmptyState, Skeleton, Disclaimer) on Tailwind 4 tokens. shadcn/ui and Zustand remain deferred.
5. **System font stack, no web fonts.** No remote resources; nothing to bundle.
6. **E2E browser:** Playwright's Chromium in CI; locally `CHROME_PATH` may point at Chrome for Testing, because branded Chrome 137+ ignores `--load-extension`.
7. **Node-only files (e2e, Playwright config) get their own `tests/e2e/tsconfig.json`** so Node types never leak into extension code.
8. **ESLint enforces the domain boundary** (no WXT/browser, Dexie, React, platform/UI imports and no `Date.now()` / `new Date()` in `src/domain`).

Known: `npm audit` reports a moderate ReDoS advisory in `minimatch` via typescript-eslint 8.72.2 (dev-only lint tooling, never shipped in the extension). Fix requires a typescript-eslint release; tracked, not overridden.
