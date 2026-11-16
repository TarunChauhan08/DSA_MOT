# ADR-0005: Derived day results via pure fold + catch-up finalization

Status: Proposed · 2026-11-16
**Decision:** Completions are append-only facts. ChallengeDay outcomes and penalties are recomputed by a pure fold; changes write new penalty revisions + audit events keyed by inputsHash. `finalizeDueDays(now)` runs on every SW start and alarm.
**Consequences:** Idempotent, no double-charging, robust to missed alarms/closed Chrome. Cost: recompute O(days) — trivial at ≤30 days.
