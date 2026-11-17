# Design

Dark-first, quiet chrome, one bold element per screen. Typeface: **Anek Latin** (Ek Type, Mumbai) — variable weight and width, tabular figures, and a real **₹** glyph; bundled locally (no network).

## Colour code (identical on every surface)

| State      | Colour             | Shape         | Where                                             |
| ---------- | ------------------ | ------------- | ------------------------------------------------- |
| Target met | emerald `--accent` | filled ✓      | day strip, tables, ring when done, badge ✓, trend |
| Partial    | amber `--warning`  | half-filled ◐ | day strip, tables, trend bars                     |
| Grace day  | blue `--info`      | dashed ring ○ | day strip, tables, grace dots                     |
| Missed     | rose `--danger`    | filled ✕      | day strip, tables, trend bars, penalty amounts    |
| Today      | violet `--violet`  | dot / outline | day strip outline, heatmap outline, calm ring     |
| Upcoming   | neutral            | —             | strip, tables                                     |

Colour is never the only signal: every state also has a shape and a text label (colour-blind safe). Heatmap intensity is separate: light → deep green by share of the day's target (owner decision).

## Behavioural mechanisms (and their limits)

| Mechanism                | Implementation                                                                                                       | Guardrail                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loss framing             | "₹10 at stake" = penalty if the day ended now                                                                        | Only real rule outcomes; always labelled virtual                                                                                                   |
| Goal gradient            | "2 more to go", ring fill, "each problem now saves ₹5"                                                               | Saving shown only when positive (a partial day can cost more than a grace-protected zero — we say "hit all N" instead of nudging toward a partial) |
| Streak protection        | "Your 5-day streak ends at midnight"                                                                                 | Only when a streak exists and today is not met                                                                                                     |
| Calibrated time pressure | Ring + countdown + toolbar badge: calm (violet/slate) → heads-up after 18:00 (amber) → urgent in the last 2 h (rose) | No pressure colours before evening                                                                                                                 |
| Immediate reward         | Ring turns emerald, one settle animation, "Streak safe"                                                              | One orchestrated motion; respects reduced-motion                                                                                                   |
| Commitment               | Confirm step, locked challenge, no quit                                                                              | Spelled out before starting                                                                                                                        |
| Fresh start              | Morning summary: "Today is a fresh start"                                                                            | Opt-in                                                                                                                                             |
| Honest progress          | Rates, ledger with revisions, heatmap from stored data                                                               | No invented stats or achievements                                                                                                                  |

## Notifications

Evening reminder (default 20:00), last call (default 60 min before midnight), target met, optional morning summary, challenge result. Each event key is sent at most once (`notificationLog`).

## Layout

Side panel first (≈360–420 px). Today: ring + one sentence → challenge strip (one segment per day) → add problem → today's list. Sections use sentence-case headings, no eyebrow labels.
