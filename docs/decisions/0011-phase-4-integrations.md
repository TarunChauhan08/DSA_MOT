# ADR-0011: Phase 4 integrations

Status: Accepted (implemented 2026-11-16)

1. **LeetCode** runs entirely in the service worker (no LeetCode content script, per owner): username verified before saving; recent-accepted batch ingested with one recompute; health and stats cached in IndexedDB `meta`, validated with Zod on read.
2. **Permissions:** `host_permissions: ["https://leetcode.com/*"]` for the GraphQL check. takeUforward access comes only from the content script `matches` (`https://takeuforward.org/*` — the sheet is a single-page app, so narrower paths would miss in-app navigation). The script reads only checkbox state and problem links.
3. **Command origins:** `TUF_SHEET_TICK` / `TUF_SHEET_OPENED` are accepted only from `https://takeuforward.org/` pages; every other command only from extension pages. A page can never impersonate the other.
4. **Already-ticked boxes are never imported** — their completion time is unknown; only live transitions count.
5. **Duplicate resolution UI:** same-title cross-platform problems are offered on Today as "Same problem / Different"; nothing merges without a decision.
6. **Fallback if LeetCode rejects extension-origin requests** (unverified risk): run the same query from a content script on leetcode.com when the user has LeetCode open (same-origin, still cookie-less). Not built unless needed.
7. **E2E:** Playwright routes `leetcode.com/graphql` and serves a takeUforward page built from the recorded markup, so the real worker and content script are exercised offline.
