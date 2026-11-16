# ADR-0003: IndexedDB via Dexie; chrome.storage.local for settings only

Status: Proposed · 2026-11-16
**Decision:** Dexie 4.4.7 for relational-ish data with versioned schema + upgrade functions; chrome.storage.local for small settings. Only the service worker writes. No `unlimitedStorage` (expected data < a few MB).
**Consequences:** One small dependency; migrations tested with fake-indexeddb fixtures.
