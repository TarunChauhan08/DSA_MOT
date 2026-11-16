# ADR-0006: Canonical problem identity

Status: Proposed · 2026-11-16
**Decision:** Source keys `lc:<titleSlug>` / `tuf:<practiceSlug>`. Mapping precedence: user decision > curated versioned dataset > none. Title similarity yields suggestions only; never auto-merges. Both source records always preserved.
**Context:** Verified 2026-11-16 that the TUF A2Z sheet links to TUF's own `/practice/dsa/<slug>` pages, not LeetCode, so URL-based mapping is unavailable.
