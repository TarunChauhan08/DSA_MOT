# ADR-0007: Owner decisions on Phase 0 open questions

Status: **Accepted** (owner, 2026-11-16)

1. Day = calendar day 00:00–24:00 Asia/Kolkata. Configurable daily deadline removed; separate reminder time for notifications.
2. Uniqueness is per day. Re-solving a problem on a later day counts again.
3. No manual backdating. Streaks update automatically.
4. Heatmap/streak colour intensity scales light → deep green with problems solved that day.
5. Challenges cannot be quit; they always run to the end (no ABANDONED state).
6. Day 1 = creation day; subsequent days begin at local midnight.
7. Striver sheet tick counts toward target (auto-detected where possible, else manual); labelled "Sheet marked complete", never "Accepted".
8. No curated 495-problem dataset. Duplicates resolved via suggestions + one-tap user decision.
9. LeetCode connected via username; extension checks the public recent-accepted list itself (see ADR-0004 rev. 2).
10. Plans: 7-day (2 grace / 5 required), **15-day (3 grace / 12 required)**, 30-day (5 grace / 25 required).
11. Streak day outside challenges requires the most recent challenge's target.
12. Timezone fixed to Asia/Kolkata.
13. (Default, not explicitly answered) Completion rates use rolling 7 and 30 days.
