# ADR-0010: Phase 3 challenge experience

Status: Accepted (implemented 2026-11-16)

1. **One derivation for reads and writes.** `application/derive.ts` computes a challenge's days from stored completions. The service worker persists it (`recompute.ts`); the UI shows it (`queries.ts`). The dashboard is therefore correct even before the worker finalizes a day.
2. **UI reads, worker writes.** Extension pages read IndexedDB through a Dexie `liveQuery`; the only writes are two Zod-validated commands to the service worker: `START_CHALLENGE` and `ADD_MANUAL_PROBLEM`. There is no edit or quit command, so a started challenge is frozen by construction. Commands are accepted only from this extension's own pages.
3. **Midnight without a live worker.** A `dsa:midnight` alarm fires 5 s after the next Kolkata midnight and a `dsa:sweep` alarm runs every 30 min; the worker also catches up on install, browser start and every wake. The UI re-derives every minute so "today" rolls over on screen.
4. **Permissions:** `alarms` added (manifest test updated). IndexedDB needs none.
5. **Manual entries** accept a LeetCode/takeUforward problem link or a plain name (slugified on the chosen platform). URLs stored for problems are rebuilt from the slug.
6. **E2E clock:** `wxt build --mode e2e` produces `.output/chrome-mv3-e2e`, the only build that honours `TEST_SET_CLOCK` (offset stored in IndexedDB `meta`). Production rejects it (`FORBIDDEN`, unit-tested).
7. **Default daily target in setup is 3** (PRD gives none); plan defaults to 7 days, ₹20/₹20.
8. **Extension icons** added (rising emerald bars on a dark tile).
