# ADR-0002: Pin TypeScript 6.0.x, not 7.0

Status: Proposed · 2026-11-16
**Context:** npm `latest` is 7.0.2, but typescript-eslint 8.72.2 peer range is `>=4.8.4 <6.1.0`.
**Decision:** Pin typescript 6.0.3 with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
**Consequences:** Revisit when typescript-eslint supports TS 7.
