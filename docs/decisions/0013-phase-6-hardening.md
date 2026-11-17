# ADR-0013: Phase 6 hardening

Status: Accepted (implemented 2026-11-18)

1. **Backups** are JSON with format id, schema version, app version and a SHA-256 checksum over canonical JSON of the data. Import order: parse → format → version (newer refused) → checksum → migrate (v1 adds `notificationLog`) → Zod per record. The worker re-validates; restore is one transaction; the UI downloads a copy of current data first. A backup identical to current data is reported, not re-imported.
2. **Reset** deletes all tables and requires the literal confirmation `RESET` (schema-enforced in the worker, not just the UI).
3. **Error boundary** per view; the disclaimer and navigation stay usable.
4. **Recovery** proven in e2e by stopping the worker through CDP (`ServiceWorker.stopWorker`) and letting midnights pass while it is dead.
5. **Accessibility:** axe (WCAG 2.1 A/AA) on every screen in both themes; light-theme tokens darkened to pass contrast.
6. **Performance:** dashboard derivation for a year of heavy use < 500 ms (asserted); popup content < 1.5 s; JS size guard 800 KiB (measured 704 KiB).
7. **Release verification:** the production build is loaded in e2e and must refuse the test clock.
