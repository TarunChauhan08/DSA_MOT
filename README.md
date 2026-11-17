# DSA Discipline

A personal Chrome extension that makes daily DSA practice stick. One daily target across **LeetCode** and **Striver's A2Z sheet**, 7/15/30-day challenges with grace days, honest streaks, a heatmap, reminders — and a **virtual** rupee penalty that grows when you skip.

> Virtual penalty only. No actual money is collected, transferred, owed or donated.

## Install (Windows, macOS, Linux)

Requires Node.js 22+ and Chrome 116+.

```sh
npm ci
npm run build
```

Chrome → `chrome://extensions` → turn on **Developer mode** → **Load unpacked** → choose `.output/chrome-mv3`. Pin the extension; the badge shows how many problems are left today.

## Use

1. **Today → Set up your first challenge:** plan, daily target, penalty. Day 1 is today; settings lock once started.
2. **Integrations:** connect your LeetCode username (no password). Tick problems on the Striver A2Z sheet while signed in to takeUforward.
3. Anything else: add it on **Today** by link or name (labelled manual).
4. **History** shows the heatmap, streaks, completion rates and the penalty ledger. **Settings** has theme, reminders and backups.

Everything stays on your computer. Download a backup from Settings before switching browsers.

## Develop

`npm run dev` · `npm run check` (typecheck, lint, format, tests, build) · `npm run test:e2e` (needs `npx playwright install chromium` or `CHROME_PATH`).

Docs: [PRD](docs/PRD.md) · [Architecture](docs/ARCHITECTURE.md) · [Domain](docs/DOMAIN_MODEL.md) · [Data](docs/DATA_MODEL.md) · [Integrations](docs/INTEGRATIONS.md) · [Design](docs/DESIGN.md) · [Security](docs/SECURITY.md) · [Testing](docs/TESTING.md) · [Roadmap](docs/ROADMAP.md) · [Decisions](docs/decisions/) · [Status](PROJECT_STATUS.md)
