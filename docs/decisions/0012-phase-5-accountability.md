# ADR-0012: Phase 5 accountability experience

Status: Accepted (implemented 2026-11-18)

1. **Analytics are pure domain functions** (`domain/analytics`): rolling 7/30-day completion rates over closed days, penalty stats in exact paise (averages per evaluated challenge day and per penalized day), heatmap weeks, urgency tiers, value of one more solve.
2. **Notifications** are planned by a pure function and deduplicated by the new `notificationLog` table (schema v2 — first real migration, tested on v1 data). A `dsa:notify` alarm wakes the worker at the next reminder time; catch-up covers missed alarms.
3. **Settings live in IndexedDB `meta`**, validated with Zod on read and write — no `storage` permission needed. New permission: `notifications`.
4. **Toolbar badge** shows problems remaining today, coloured by urgency (✓ when met). No permission required.
5. **Ledger is the persisted record** (latest revision per day, with the pre-revision amount when late data changed it); stats and trend are derived.
6. **Typeface:** Anek Latin variable (latin + latin-ext ≈ 185 KB) chosen because system fonts and Instrument Sans/Onest lack a matching ₹ glyph.
7. **Design rules** in docs/DESIGN.md.
