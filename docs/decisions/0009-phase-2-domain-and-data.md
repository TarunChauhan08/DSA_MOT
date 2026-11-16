# ADR-0009: Phase 2 domain and data decisions

Status: Accepted (implemented 2026-11-16)

1. **No date-fns.** `Intl.DateTimeFormat` covers day keys and DST-aware midnights; one dependency fewer than ADR stack table.
2. **Application layer uses the Dexie database directly** instead of repository interfaces. Tests run the real Dexie on fake-indexeddb, so ports would add indirection without improving testability. The domain stays pure.
3. **Completions store only the source key.** Canonical identity is resolved from `mappings` at count time, so a later "same problem" decision recomputes affected days automatically.
4. **Derived, idempotent results** (ADR-0005) with an `inputsKey` fingerprint per day; ledger and audit rows only on change.
5. **Penalized-day sequence restarts per challenge.**
6. **Limits:** daily target 1–100; start penalty and increment ₹0–₹1,00,000. Keeps integer maths exact and catches typos.
7. **Manual entries and sheet ticks take the recording time** (no backdating, ADR-0007 Q3). A sheet tick is idempotent per problem per IST day.
8. **Schema v1 is lean:** `notificationLog` arrives with Phase 5 as v2; `streakSnapshots` dropped.
9. **Service-worker wiring and the `storage`/`alarms` permissions move to Phase 3**, when the UI first writes data. Phase 2 code is exercised by integration tests only.
10. **CI:** actions bumped to v7 (Node 24); CI runs `npm run coverage`, which enforces domain coverage thresholds.
