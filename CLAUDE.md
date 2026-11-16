# CLAUDE.md — DSA Discipline

Personal, local-first MV3 Chrome extension: one unified daily DSA target fed by LeetCode + Striver A2Z (takeUforward), with challenges, streaks and a **virtual-only** INR penalty.

## Critical constraints

- NO real money: no wallet, payments, UPI, donations, transfers, accounts, backend, cloud sync.
- Always show: "Virtual penalty only. No actual money is collected, transferred, owed or donated."
- Never read/store LeetCode/TUF credentials, cookies or tokens. LeetCode: username-based public queries only (recent-accepted ≤1 req/30 min + debounced on-demand; stats card ≤1 req/6 h), `credentials: "omit"` (ADR-0004). No other requests to LeetCode/TUF.
- Money = integer paise, round-half-up. Never floats.
- Store UTC; a day is 00:00–24:00 Asia/Kolkata; attribute by source timestamp. Plans: 7/15/30 days. Owner decisions: docs/decisions/0007.
- Never depend on the service worker staying alive; catch-up finalization runs on every SW start.

## Architecture boundaries

- `src/domain` is pure: no `chrome`, `dexie`, `react`, `Date.now()`.
- Only the background SW writes IndexedDB. UI reads via Dexie liveQuery, writes via Zod-validated messages.
- Content scripts only emit `RawCompletionEvent`s; never touch storage.
- Penalty/streak/challenge logic never inside React components.

## Coding rules

Strict TS, no `any`, Zod at every external boundary, small modules, no silent catches, no magic numbers, no circular deps.

## Testing

TDD for domain logic. Never weaken tests to pass. Never claim tests ran unless they did.
Commands (npm, Node ≥ 22):

- `npm run dev` — WXT dev build with HMR · `npm run build` — production build to `.output/chrome-mv3`
- `npm run typecheck` · `npm run lint` · `npm run format:check` · `npm test` (Vitest)
- `npm run test:e2e` — e2e build (`--mode e2e`, enables the test clock) + Playwright with the unpacked extension (needs `npx playwright install chromium`, or `CHROME_PATH` to a Chrome for Testing binary)
- `npm run check` — everything except e2e; must pass before a phase is reported done

## Process

Phased workflow (docs/PRD.md §19). Stop at phase end and report (PRD §21). No destructive git. Push only when the owner asks; work on a branch and merge via PR after CI passes. Ask on ambiguous requirements.

Requirements: docs/PRD.md · Proposal: docs/PHASE_0_PROPOSAL.md · Decisions: docs/decisions/
