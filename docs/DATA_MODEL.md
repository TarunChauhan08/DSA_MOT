# Data model

IndexedDB via Dexie (`src/persistence/`), database `dsa-discipline`. Only the background service worker writes (wired in Phase 3).

## Schema v1 (`schema.ts`)

| Table            | Keys / indexes                             | Purpose                                                                  |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| `challenges`     | `id`, `status`, `startDay`                 | Frozen config, start/end day, `ACTIVE`/`PASSED`/`FAILED`                 |
| `challengeDays`  | `[challengeId+day]`, `challengeId`         | Derived day result + `inputsKey` fingerprint + `revision`                |
| `penaltyRecords` | `++id`, `[challengeId+day]`, `challengeId` | Append-only virtual penalty ledger (`FINALIZED` / `REVISED`)             |
| `completions`    | `id`, `sourceKey`, `sourceTimestampMs`     | Raw completion facts (source key only; canonical resolved at count time) |
| `mappings`       | `id` (= "a\|b")                            | User same/different-problem decisions                                    |
| `auditEvents`    | `++seq`, `type`, `atMs`                    | Append-only audit trail                                                  |
| `meta`           | `key`                                      | Small key/value                                                          |

Deferred to the phase that needs them (added as new schema versions): `notificationLog` (Phase 5). `streakSnapshots` dropped — streaks are cheap to derive.

## Completion ids (idempotent ingest)

| Source             | Id                                | Timestamp                     |
| ------------------ | --------------------------------- | ----------------------------- |
| LeetCode accepted  | `lc-ac:<submissionId>`            | LeetCode's timestamp          |
| TUF accepted       | `tuf-ac:<submissionId>`           | TUF's timestamp               |
| Striver sheet tick | `tuf-sheet:<sourceKey>:<IST day>` | time recorded                 |
| Manual             | `manual:<uuid>`                   | time recorded (no backdating) |

Timestamps more than 5 minutes in the future are rejected.

## Derivation (`application/recompute.ts`)

`recomputeAll(now)` re-derives every **closed** day (before today in the challenge zone) for every challenge in one transaction:

1. Load completions in the challenge window; resolve canonical keys from `mappings`.
2. Count each day; run the fold.
3. For each day, compare `inputsKey`; write only if changed (`revision + 1`, ledger row if the penalty changed, `DAY_FINALIZED` / `DAY_REVISED` audit).
4. After the last day: set `PASSED`/`FAILED`; a later change logs `CHALLENGE_OUTCOME_REVISED`.

It is called on every completion and must be called on every service-worker start (catch-up). Running it twice writes nothing.

## Migrations

Never edit a released version. Append `{ version, stores, upgrade }` to `SCHEMA_VERSIONS`; `tests/integration/migrations.test.ts` checks reopen-preserves-data and that upgrades run on existing data.
