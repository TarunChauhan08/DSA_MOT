# DSA Discipline

A personal, local-first Chrome extension that makes daily DSA practice stick: one unified daily target across LeetCode and Striver's A2Z sheet, 7/15/30-day challenges, honest streaks, and a **virtual** INR penalty for missed targets.

> Virtual penalty only. No actual money is collected, transferred, owed or donated.

**Status:** Phase 3 — challenges, daily target, grace days, virtual penalties and streaks work with manual entries. Automatic LeetCode/Striver tracking comes in Phase 4. See `PROJECT_STATUS.md`.

## Setup (Windows, macOS or Linux)

Requires Node.js 22+.

```sh
npm ci
npm run build
```

Load it in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `.output/chrome-mv3`.

For development with hot reload: `npm run dev`.

## Checks

```sh
npm run check                       # typecheck, lint, format, unit tests, build
npx playwright install chromium     # once
npm run test:e2e                    # loads the built extension in Chromium
```

Branded Google Chrome no longer honours `--load-extension`, so e2e tests use Playwright's Chromium (or set `CHROME_PATH` to a Chrome for Testing binary).

## Docs

- Requirements: `docs/PRD.md`
- Architecture proposal and owner decisions: `docs/PHASE_0_PROPOSAL.md`
- Decision records: `docs/decisions/`
