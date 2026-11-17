# Architecture

```mermaid
flowchart LR
  subgraph Sites["Websites (untrusted)"]
    LCAPI["leetcode.com/graphql (public, by username)"]
    TUF["takeuforward.org A2Z sheet"]
  end
  subgraph CS["Content script"]
    DET["tuf.content.ts → sheetDetector (tick transitions)"]
  end
  subgraph SW["Service worker — sole writer"]
    R["router.ts: sender check + Zod commands"]
    UC["application/: use cases, sync, backup, notify"]
    D["domain/: pure rules"]
    AL["alarms: midnight · 30-min sweep · reminder"]
  end
  DB[("IndexedDB (Dexie, schema v2)")]
  subgraph UI["Extension pages (React)"]
    P["popup"] --- S["side panel"] --- O["options"]
  end
  TUF -. DOM .-> DET -- TUF_SHEET_TICK --> R
  UC -- "fetch, credentials: omit" --> LCAPI
  R --> UC --> D
  UC --> DB
  AL --> UC
  UI -- "liveQuery (read)" --> DB
  UI -- "commands" --> R
```

## Layers

| Layer        | Folder                           | Rule                                                                                                                                                                                   |
| ------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain       | `src/domain`                     | Pure TS. No browser APIs, Dexie, React or clock (ESLint-enforced). Money, calendar, plans, penalty fold, counting, identity, streaks, analytics, notification planning.                |
| Application  | `src/application`                | Use cases over Dexie: start, record (single/batch), finalize/recompute, mapping, LeetCode sync, Striver intake, settings, notifications, backup/restore, read model (`loadDashboard`). |
| Persistence  | `src/persistence`                | Dexie schema versions + migrations, record types.                                                                                                                                      |
| Platform     | `src/platform`, `src/background` | Clock (e2e override), side panel, router, alarms, notifier, badge.                                                                                                                     |
| Integrations | `src/integrations`               | LeetCode GraphQL client, Striver sheet detector. Parse only; never write.                                                                                                              |
| UI           | `src/ui`                         | React views; formatting and copy only. No rules.                                                                                                                                       |

## Key flows

- **Write path:** page/content script → `runtime.sendMessage` → `handleCommand` (sender origin + Zod) → use case → Dexie transaction → `afterChange` (badge, notifications, next alarm).
- **Day close:** derived, never accumulated. `recomputeAll(now)` re-runs the fold for every closed day; a day is rewritten only if its `inputsKey` changed (new ledger row + audit). Called on every completion, alarm and worker wake.
- **Read path:** `loadDashboard(db, now)` derives everything from stored facts, so screens are correct even before the worker finalizes.

Decisions: `docs/decisions/` (ADR-0001 … 0013).
