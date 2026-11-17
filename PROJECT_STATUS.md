# Project Status

| Phase                  | Status                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 0 Discovery & Planning | **Proposal delivered; owner answered open questions 2026-11-16 (ADR-0007). Awaiting approval to start Phase 1.**     |
| 1 Foundation           | Not started (blocked on Phase 0 approval)                                                                            |
| 2 Data & Domain        | Not started                                                                                                          |
| 3 Challenge Experience | Not started                                                                                                          |
| 4 Integrations         | Not started (LeetCode username query verified 2026-11-16; still needs a same-day solve test and TUF signed-in recon) |
| 5 Accountability       | Not started                                                                                                          |
| 6 Hardening            | Not started                                                                                                          |

## Phase 0 summary

- Repo was an empty `git init` (no commits). Only documentation was added; nothing committed.
- Verified: TUF sheet moved to `/prep-hub/`, 495 problems, own judge at `/practice/dsa/<slug>`, no LeetCode links; progress needs login.
- Verified: LeetCode problem page exposes `__NEXT_DATA__` question metadata and `data-e2e-locator` hooks; ToS forbids scraping.
- Not verified: Accepted-result DOM on LeetCode and TUF (requires owner sign-in).
- Open questions: docs/PHASE_0_PROPOSAL.md §N.

## Owner decisions (2026-11-16)

See docs/decisions/0007-owner-decisions-2026-11-16.md. LeetCode via username (ADR-0004 rev. 2). 15-day plan added (3 grace / 12 required).

## Phase 1 — Foundation (2026-11-16)

**Implemented:** WXT 0.21.5 + React 19.3 + TypeScript 6.0.3 (strict) project; MV3 manifest (`sidePanel` only); popup, side panel dashboard and options page (opens on Settings); hash routing for Today / Challenge / History / Integrations / Settings / New challenge; Tailwind 4 design tokens (dark default, light tokens ready); Disclaimer, Button, EmptyState, Skeleton primitives; ESLint (strict type-checked + domain boundary rules), Prettier, Vitest + Testing Library, Playwright e2e with the unpacked extension, GitHub Actions CI.

**Verified (actual runs, clean `npm ci`):**

- `npm run check` → typecheck ✓, lint ✓, format ✓, unit 19/19 ✓ (5 files), build ✓ (238 kB, manifest permissions: `sidePanel`).
- `npm run test:e2e` (Chrome for Testing 153) → 4/4 ✓: popup renders + disclaimer, side panel navigation, options opens on Settings, dark theme default.
- Domain/React lint rules confirmed to fire on probe files.

**Verified later:** CI passed on GitHub (run 43784143305). Build not yet run on the owner's Windows machine.

**Known limitations:** no extension icons yet (Chrome shows a default letter icon) — planned with the design pass in Phase 3; all views are honest empty states; light-theme toggle needs settings storage (Phase 3+); moderate dev-only `minimatch` audit advisory (ADR-0008).

## Phase 2 — Data & Domain (2026-11-16)

**Implemented:** pure domain (money in paise, Kolkata calendar, 7/15/30 plans, penalty fold, per-day counting with manual→verified upgrade, cross-platform identity, streaks, heatmap intensity); Dexie schema v1 + migration harness; Zod boundary for completion events; use cases `startChallenge`, `recordCompletion`, `decideMapping`, `finalizeDueDays` (idempotent catch-up + late-data revision with audit). Docs: DOMAIN_MODEL.md, DATA_MODEL.md, ADR-0009.

**Verified (actual runs):** `npm run check` ✓ — 174 tests (unit + property + integration); coverage domain ≥ 95% lines / ≥ 90% branches ✓; e2e 4/4 ✓.

**Not done in this phase (by design, ADR-0009):** service-worker wiring, `storage`/`alarms` permissions, any UI for challenges (Phase 3). CI action bump to v7 not yet run on GitHub.

## Phase 3 — Challenge experience (2026-11-16)

**Implemented:** onboarding; challenge setup (7/15/30, target, ₹ start/increase, manual toggle) with live summary and a confirm step; Today view (progress, streak, potential penalty, challenge stats, add problem by link or name, today's list with verification labels); Challenge view (locked config, every day with outcome and penalty); History (all-time stats, challenge list); popup summary; background service worker (validated commands, midnight + sweep alarms, catch-up on every wake); extension icons. ADR-0010.

**Verified (actual runs):** `npm run check` ✓ (229 tests); e2e 6/6 ✓ three runs in a row, including a full 7-day lifecycle (success, partial ₹10, two grace days, missed ₹40/₹60/₹80 → FAILED ₹190), blocked second challenge, rejected edit command.

**Known limitations:** no automatic LeetCode/Striver tracking yet (Phase 4) — entries are manual and labelled; no heatmap, notifications or settings (Phase 5); no export/import (Phase 6).

## Phase 4 — Integrations (2026-11-16)

**Implemented:** LeetCode by username (connect with verification, 30-min checks + on open, backoff, stats card, disconnect); Striver sheet tick detection (both layouts, lessons ignored, live transitions only); takeUforward-only command channel; same-problem suggestions with Same/Different decisions; Integrations page with status, last check, troubleshooting. docs/INTEGRATIONS.md, ADR-0011.

**Verified (actual runs):** `npm run check` ✓ (274 tests); e2e 10/10 ✓ — real worker against mocked LeetCode GraphQL (no cookies sent), unknown username error, real content script on a page built from recorded takeUforward markup (problem counted as "Sheet marked", lesson ignored), duplicate merge.

**Not verified (needs the owner):** LeetCode request from the extension origin; a sheet tick while signed in to takeUforward. Checklist in docs/INTEGRATIONS.md. takeUforward judge verdicts not implemented.

## Phase 5 — Accountability (2026-11-18)

**Implemented:** behavioural design pass (day ring with time-pressure colour, ₹ at stake, value of the next solve, streak-at-risk warning, countdown, grace dots, challenge day strip, one restrained reward); shared colour code with shapes and labels; History with 18-week heatmap, current/longest streak, full and incomplete days, problems solved, 7/30-day completion rates, penalty stats, trend bars and persisted ledger with revisions; Settings (theme, reminders, last call, target met, morning summary, manual default); notifications with once-only log (schema v2); toolbar badge; light theme; Anek Latin typeface. docs/DESIGN.md, ADR-0012.

**Verified (actual runs):** `npm run check` ✓ (320 tests); e2e 13/13 ✓ incl. reminder sent once, badge slate → amber → ✓, theme persists across pages, history from real data. Screens reviewed visually in dark and light.
