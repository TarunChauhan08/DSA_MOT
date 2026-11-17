# Security and privacy review (2026-11-18)

## Permissions

| Permission                                  | Why                                                     | Install warning                                 |
| ------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| `sidePanel`                                 | Dashboard in the side panel                             | none                                            |
| `alarms`                                    | Close days at midnight, 30-min catch-up, reminder times | none                                            |
| `notifications`                             | Optional reminders (each once)                          | "Display notifications"                         |
| host `https://leetcode.com/*`               | Public GraphQL check by username                        | "Read and change your data on leetcode.com"     |
| content script `https://takeuforward.org/*` | Detect ticks on the A2Z sheet                           | "Read and change your data on takeuforward.org" |

Not requested: `<all_urls>`, `tabs`, `history`, `cookies`, `webRequest`, `scripting`, `debugger`, `storage`, `downloads`, `unlimitedStorage`. A unit test pins the permission list.

## Data

- Local only (IndexedDB). No backend, accounts, analytics or telemetry. No real money anywhere; every penalty surface shows the virtual-only disclaimer.
- Stored: problem slugs/titles, timestamps, challenge config and results, settings, LeetCode **username** (public). Never: passwords, cookies, tokens, code, browsing history.
- LeetCode requests use `credentials: "omit"` (e2e asserts no cookie header). takeUforward: the content script reads checkbox state and problem links only.

## Trust boundaries

| Input                  | Control                                                                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Messages to the worker | `sender.id` must be this extension; extension pages may send app commands only; `https://takeuforward.org/` pages may send tick reports only (exact origin prefix — `takeuforward.org.evil.com` rejected, tested). Every command Zod-validated (`.strict()`); no edit/quit command exists. |
| LeetCode responses     | Zod schema; slugs re-validated; URLs rebuilt from slugs                                                                                                                                                                                                                                    |
| Sheet DOM              | Slug pattern `[a-z0-9-]`, title length cap, theory rows ignored                                                                                                                                                                                                                            |
| Backup files           | JSON parse → format/version check → SHA-256 checksum → per-record Zod; the worker re-validates (page preview not trusted); all-or-nothing transaction; copy of current data saved before restore                                                                                           |
| Rendering              | React text only — no `dangerouslySetInnerHTML`; links open with `rel="noreferrer"`                                                                                                                                                                                                         |
| Test clock             | Compiled only into `--mode e2e` builds; release build refuses it (e2e-tested)                                                                                                                                                                                                              |

MV3 default CSP; no remote code, no `eval`, fonts bundled locally.

## Dependency advisories (dev/build tooling only — not shipped)

- `minimatch` (moderate, via typescript-eslint) and `picomatch` (high, all versions, via Vite/Rollup tooling): ReDoS on attacker-supplied glob patterns. Only our own config globs are used at build time; nothing reaches the extension bundle. Re-check on dependency updates.
