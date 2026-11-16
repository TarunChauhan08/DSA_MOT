# ADR-0001: Use WXT as the extension framework

Status: Proposed · 2026-11-16
**Context:** Need MV3 build with multiple entrypoints (SW, 2 content scripts, popup, side panel, options), HMR, manifest generation. Options: WXT, CRXJS, Plasmo, hand-rolled Vite.
**Decision:** WXT 0.21.5 (Vite 8, modified 2026-10-26) with @wxt-dev/module-react.
**Consequences:** File-based entrypoints reduce config; pre-1.0 so pin exact version. Plasmo rejected (no core release since 2025, Parcel). CRXJS viable fallback.
