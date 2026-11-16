# Integrations

## LeetCode — by username (ADR-0004 rev. 2/3)

|             |                                                                                                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mechanism   | Service worker POSTs to `https://leetcode.com/graphql/` with `credentials: "omit"`: `recentAcSubmissionList(username, limit)` + `matchedUser { username }`; stats via `submitStatsGlobal.acSubmissionNum` |
| Cadence     | ≤ 1 check / 30 min (sweep alarm + worker wake), popup/dashboard open (debounced 2 min), backoff 30→60→…→360 min after errors; stats ≤ 1 / 6 h                                                             |
| Counts as   | `LC_RECENT_AC` → **Verified**, attributed to the day of LeetCode's timestamp (Asia/Kolkata)                                                                                                               |
| Idempotency | completion id `lc-ac:<submissionId>`                                                                                                                                                                      |
| Code        | `src/integrations/leetcode/client.ts`, `src/application/leetcodeSync.ts`                                                                                                                                  |

**Verified (2026-11-16, owner's profile, from a LeetCode page, no cookies):** 200 OK; fields `id`, `title`, `titleSlug`, `timestamp` (string seconds); list capped at **10** entries even when asking for 50; unknown user → `matchedUser: null`.

**Not verified:** the same request sent **from the extension** (origin `chrome-extension://…`). The build environment cannot reach leetcode.com. Evidence it should work: the endpoint accepted cookie-less, token-less POSTs, so it is not CSRF-protected. → Owner live check below.

## Striver A2Z — sheet ticks (owner decision Q7)

|                   |                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Mechanism         | Content script on `https://takeuforward.org/*` observes the sheet's checkboxes; reports **unticked → ticked** transitions only |
| Problem vs lesson | Problem rows link to `/practice/dsa/<slug>`; theory lessons link only to `/blogs/…` → ignored                                  |
| Counts as         | `TUF_SHEET_CHECKBOX` → **Sheet marked** (never "Accepted"); one per problem per IST day                                        |
| Code              | `src/integrations/tuf/sheetDetector.ts`, `src/entrypoints/tuf.content.ts`, `src/application/tufIntake.ts`                      |

**Recon (2026-11-16, signed out):**

- Sheet URL `/prep-hub/strivers-a2z-dsa-sheet`; 495 items including theory lessons.
- Two layouts: wide = `<tr data-row-type="practice" data-sheet-row-key="practice-N">`, narrow = `<article role="button" data-sheet-row-key="practice-N">`. Both contain `button[role="checkbox"][aria-checked][data-state][aria-label="Mark <title> complete"]`.
- Class names are hashed CSS modules — never used.
- Signed out, clicking a checkbox opens "Log in/Sign up to save this problem as completed" and the box **stays unchecked** → no false ticks.

**Not verified:** a tick while signed in (does `aria-checked` flip to `true` in place?). → Owner live check below.

**Not implemented:** takeUforward judge "Accepted" verdicts on `/practice/dsa/<slug>` — DOM unknown without a signed-in session; ticking the sheet covers the owner's workflow.

## Owner live verification (Phase 4 acceptance)

1. Load the build, open **Integrations**, connect your LeetCode username → expect **Active** and the stats card (Solved/Easy/Medium/Hard).
2. Solve and submit any LeetCode problem, then open the popup → within ~2 minutes it shows on **Today** as **Verified**.
3. Signed in to takeUforward, tick one practice problem on the A2Z sheet → it shows on **Today** as **Sheet marked** (untick afterwards if you like; it stays counted for today).

If step 1 fails with "LeetCode answered with HTTP 403", LeetCode is refusing extension requests — report it and the fallback in ADR-0011 is used.

## Troubleshooting (also shown in the UI)

- LeetCode "Needs attention": the message says why; checks retry automatically with backoff.
- Ticks not appearing: make sure you are signed in to takeUforward and ticked on the A2Z sheet page; add the problem manually on Today if the site changed.
