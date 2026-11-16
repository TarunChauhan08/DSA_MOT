# Domain model

Pure TypeScript in `src/domain/` — no browser APIs, database, React or clock reads (ESLint-enforced). Every rule below has tests in `tests/unit/domain/`.

## Money (`money.ts`)

- `Paise` is a branded non-negative safe integer. Rupees are converted with `rupeesToPaise` (whole rupees only).
- `roundHalfUpDiv(n, d) = floor((2n + d) / 2d)` — exact integer round-half-up, checked against a BigInt reference by property tests.

## Calendar (`calendar.ts`)

- `DayKey` = `YYYY-MM-DD` in an IANA zone. A day is local 00:00–24:00 (ADR-0007); default zone `Asia/Kolkata`.
- `dayKeyOf(instant, tz)`, `startOfDayMs(day, tz)` (DST-aware), `addDays`, `daysBetween`. Built on `Intl` only.

## Challenge (`challenge/`)

| Plan | Grace days | Required successful days |
| ---- | ---------- | ------------------------ |
| 7    | 2          | 5                        |
| 15   | 3          | 12                       |
| 30   | 5          | 25                       |

- Config: plan, daily target (1–100), start penalty and increment (₹0–₹1,00,000 each), time zone, `countManual`. Frozen at start.
- **Fold** `evaluateDays(config, counts)` walks days in order carrying grace used and the penalized-day index:
  - `solved ≥ target` → `SUCCESS`, ₹0
  - `solved = 0` and grace left → `ZERO_GRACE`, ₹0, grace +1
  - otherwise → penalized index +1, `rate = start + (index − 1) × increment`
    - `solved = 0` → `ZERO_PENALIZED`, full rate
    - partial → `PARTIAL_PENALIZED`, `roundHalfUp(rate × shortfall / target)`
- The penalized-day sequence restarts for every challenge (assumption; PRD formula is per challenge).
- `summarize` → success days, grace used/remaining, total/highest penalty, `IN_PROGRESS | PASSED | FAILED`, `canStillPass`.
- `projectToday` → today's result if the day ended now ("potential penalty").

## Counting (`completion/counting.ts`)

- Evidence: `LC_RECENT_AC`, `TUF_SUBMISSION_ACCEPTED` (auto-verified), `TUF_SHEET_CHECKBOX`, `USER_MANUAL` (manual).
- A day's count = distinct canonical problems that day (uniqueness is **per day**, ADR-0007 Q2).
- Within a problem: auto-verified beats sheet beats manual; ties by time then id. Manual entries next to a verified one become `SUPERSEDED_BY_VERIFIED` (the "upgrade").
- `countManual = false` excludes manual and sheet entries.
- Facts are bucketed by **source timestamp** in the challenge zone, not discovery time.

## Identity (`identity/identity.ts`)

- Source keys `lc:<slug>` / `tuf:<slug>`; slugs validated (`[a-z0-9-]`, ≤ 200).
- Canonical key = smallest key of a group merged by user `SAME` decisions (transitive; latest decision per pair wins).
- `suggestDuplicates`: cross-platform identical normalized titles only — suggestions, never merges.

## Streak (`streak/streak.ts`)

- A day extends the streak only if a target applies and is met. Partial, grace and zero days break it; an unfinished today does not.
- Target outside challenges = most recent challenge's target; before any challenge there is no target (ADR-0007 Q10).
- `intensityLevel` (heatmap): 0 none · 1 < 50% · 2 ≥ 50% · 3 target met · 4 ≥ 150%. Without a target: 1 / 2 / 4 / 6 problems.
