# ADR-0004 (rev. 2): LeetCode detection strategy

Status: **Accepted** by owner 2026-11-16 (rev. 1 proposed passive DOM only)

**Context:** No supported public API. LeetCode ToS forbids crawling/scraping. Owner wants the extension to check his own account automatically, without opening LeetCode.

**Decision:**

- Primary: owner enters LeetCode username. Service worker queries `recentAcSubmissionList(username, limit)` at `https://leetcode.com/graphql/` with `credentials: "omit"`. Uses server `timestamp` as the source timestamp. It counts the distinct problems whose timestamp falls on that Kolkata day, and does nothing else. Cadence: ≤1 request / 30 min (chrome.alarms) plus on popup open (debounced 2 min). Exponential backoff on errors/429.
- **Owner simplification (2026-11-16):** no LeetCode content script, no DOM observation, no total-solved gap detection. The username check is the only LeetCode mechanism.

**Policy assessment:** Undocumented internal endpoint; automated access conflicts in spirit with the ToS anti-crawling clause. Accepted by owner as personal, low-volume access to his own public profile data, with no credentials, cookies or tokens used.

**Live verification (2026-11-16, owner username, signed out, credentials omitted):**

- HTTP 200; `matchedUser` found; `recentAcSubmissionList` returned `id, title, titleSlug, timestamp`.
- `timestamp` is a **string** of Unix seconds → Zod must coerce to number.
- Requested limit 50 → **only 10 returned** while the profile has 57 solved (`submitStatsGlobal`). So the public list is **capped at ~10** most recent accepted entries; all 10 had distinct slugs (may be one entry per problem — unconfirmed).
- No solve today in the data (newest was Feb 2026), so same-day detection is still to be confirmed with a real solve in Phase 4.

**Limitations:** the list holds only ~10 recent accepted entries; every seen entry is stored, so solves are missed only if >10 accepted happen within 30 minutes (accepted by the owner). Breaks if the query/schema changes or the profile is private → Degraded state, manual fallback.

**Rejected:** reading cookies/session tokens; storing passwords; MAIN-world response interception (unnecessary now).

## Rev. 3 addendum (owner approved 2026-11-16): profile stats card

Show all-time solved with Easy/Medium/Hard breakdown (as in the owner's reference screenshot). Uses the same public GraphQL endpoint (`matchedUser { submitStatsGlobal { acSubmissionNum } }`, verified 2026-11-16 on the owner's profile), `credentials: "omit"`, fetched **at most once every 6 hours** and cached. Display only — never used for counting the daily target. Implemented in Phase 4.
