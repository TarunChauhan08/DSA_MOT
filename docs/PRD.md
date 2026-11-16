# DSA Discipline — Product Requirements (source of truth)

> Verbatim copy of the product brief supplied by the owner on 2026-11-16.
> Do not edit requirements here without owner approval. Interpretations and open
> questions live in `PHASE_0_PROPOSAL.md` §N and in `docs/decisions/`.

```text

# PROJECT: DSA DISCIPLINE
# ROLE: Principal Engineer, Product Architect and Senior Chrome Extension Developer

You are responsible for helping me design and build a production-quality Chrome extension called DSA Discipline.

Do not behave like a code-generation chatbot. Work like a senior engineer building a real software product.

Think carefully about architecture, data integrity, website integration, user experience, security and testability.

==================================================
1. PRODUCT VISION
==================================================

DSA Discipline is a premium Chrome extension that helps me consistently
solve Data Structures and Algorithms problems every day.

It connects:
- LeetCode
- Striver A2Z DSA Sheet

Both sources contribute to ONE unified daily DSA target.

The application should motivate me through:
- Daily targets
- Streaks
- 7-day and 30-day challenges
- Progress tracking
- Daily completion reminders
- Challenge completion statistics
- A virtual financial penalty system in INR
- Beautiful analytics and history

The goal is to make skipping DSA feel psychologically expensive and
consistent DSA practice rewarding.

This is a PERSONAL, LOCAL-FIRST Chrome extension.

==================================================
2. NON-NEGOTIABLE SCOPE
==================================================

This product has NO real-money functionality.

DO NOT implement:
- Real wallet
- Bank account integration
- UPI integration
- Payment gateway
- Payment mandate
- Donations
- Automatic money transfers
- Withdrawal functionality
- Payment backend
- User accounts
- Subscription system
- Cloud synchronization

The penalty amount is purely virtual.

It is only an accountability metric displayed in Indian Rupees.

Show a persistent disclaimer in the application:

"Virtual penalty only. No actual money is collected, transferred,
owed or donated."

The application should only calculate and display how much I would
have hypothetically lost by not completing my DSA target.

Never describe a virtual penalty as an actual payment or debt.

==================================================
3. CHALLENGE SYSTEM
==================================================

Users can create either:

A. 7-DAY CHALLENGE
- Duration: 7 consecutive calendar days.
- Maximum zero-activity grace days: 2.
- Required successful days: at least 5.
- Challenge settings become immutable after starting.

B. 30-DAY CHALLENGE
- Duration: 30 consecutive calendar days.
- Maximum zero-activity grace days: 5.
- Required successful days: at least 25.
- Challenge settings become immutable after starting.

During challenge setup, the user chooses:
- Challenge duration.
- Daily DSA problem target.
- Starting penalty amount.
- Penalty increment.
- Daily deadline.
- Timezone.

Defaults:
- Starting penalty: ₹20.
- Penalty increment: ₹20.
- Deadline: 11:59 PM.
- Timezone: Asia/Kolkata.

Allow configurable values before starting a challenge.

Once started:
- Freeze challenge configuration.
- Do not allow editing the target or penalty rules.
- Keep historical challenges unchanged.
- Allow users to view previous challenges.
- Prevent overlapping active challenges unless there is a
  clearly designed and tested alternative.

CHALLENGE SUCCESS CRITERIA:

7-day challenge:
At least 5 days must have the full daily target completed.

30-day challenge:
At least 25 days must have the full daily target completed.

Partial days do not count as successful days.

Grace days do not turn incomplete days into successful days.

The grace allowance only determines whether a zero-activity day
receives a virtual penalty.

==================================================
4. DAILY DSA TARGET
==================================================

The user chooses a daily problem target.

Example:
Daily target = 4 problems.

Both platforms contribute to the same target.

Example:

LeetCode:
2 unique problems completed.

Striver A2Z:
2 unique problems completed.

Unified progress:
4 / 4.

The user must never need to maintain separate daily targets
for LeetCode and Striver.

RULES:

- Only genuine problem completions count.
- Opening a problem does not count.
- Visiting a page does not count.
- Incorrect submissions do not count as accepted submissions.
- One unique problem cannot count twice.
- Cross-platform duplicates must be detected wherever possible.
- Record the source platform.
- Record the problem title and URL.
- Record the completion timestamp.
- Record verification type.

VERIFICATION TYPES:

1. Automatically verified.
2. Manually marked.
3. Awaiting verification.
4. Duplicate / excluded.

Manual completion is permitted because some integrations might
not expose reliable completion events.

Manual entries should count toward the daily target by default,
but must always be visibly distinguished from automatic verification.

Provide a setting to disable manually marked problems from
contributing to the daily target.

If a manually marked problem is subsequently automatically verified,
upgrade its verification status instead of counting it twice.

==================================================
5. LEETCODE INTEGRATION
==================================================

Build a dedicated LeetCode integration adapter.

Expected behaviour:

- Detect successful Accepted submissions where technically possible.
- Capture problem title.
- Capture problem slug or canonical identifier.
- Capture problem URL.
- Capture difficulty when available.
- Capture submission time.
- Record the verification method.
- Detect repeated submissions for the same problem.
- Prevent duplicate counting.

IMPORTANT:

Do not assume LeetCode provides a supported public API for every
piece of information required.

Investigate the real current website before implementing.

Prefer reliable visible-page integration and supported interfaces.

Do not:
- Ask for or store LeetCode passwords.
- Extract authentication cookies or tokens.
- Use undocumented private endpoints without a documented
  technical and policy assessment.
- Claim successful automatic tracking without testing it.

If automatic tracking only works while the LeetCode page is open,
explain that limitation in the UI.

Provide a manual fallback.

Provide a connection status indicator.

==================================================
6. STRIVER A2Z INTEGRATION
==================================================

Build a separate Striver A2Z adapter.

First investigate the current actual website.

Determine:
- How the sheet displays completed problems.
- Whether progress is persisted.
- Whether completion is visible in the DOM.
- Whether the site requires login.
- Whether there is an official supported integration.
- Whether a reliable completion event can be detected.

Do not assume a checkbox means that code was successfully submitted.

Distinguish:
- Sheet marked complete.
- Manually marked complete.
- Automatically verified coding submission.

Never label a sheet checkbox as a successful Accepted submission.

Provide manual completion fallback when automatic detection is
not reliably available.

The extension must continue functioning if Striver changes its
website layout.

==================================================
7. CROSS-PLATFORM DEDUPLICATION
==================================================

Build a canonical problem identity system.

A problem appearing on both LeetCode and Striver must not count
twice when it represents the same underlying problem.

Investigate:
- Canonical identifiers.
- Problem slugs.
- URLs.
- Known aliases.
- Problem mapping datasets.
- User-assisted duplicate resolution.

Do not incorrectly merge two different problems simply because
their titles are similar.

When identity is uncertain:
- Clearly display the uncertainty.
- Let the user resolve the mapping.
- Preserve both original source records.
- Record the resolution.

This functionality needs dedicated unit and integration tests.

==================================================
8. GRACE DAYS AND PENALTY ENGINE
==================================================

This is one of the most important modules.

Implement penalty calculations as pure, independently testable
domain logic.

STARTING PENALTY:
₹20.

PENALTY INCREMENT:
₹20.

THE USER'S RULES:

A. Full target completed:
- No penalty.
- Counts as a successful DSA day.
- Does not advance the penalty rate.

B. Partially completed:
- Always incurs proportional penalty.
- Does not consume a grace day.
- Does not count as a successful day.
- Advances the penalized-incomplete-day sequence.

C. Zero questions completed while grace days remain:
- Consume one grace day.
- No penalty.
- Does not count as a successful day.
- Does not advance the penalty rate.

D. Zero questions completed after grace days are exhausted:
- Full current penalty rate applies.
- Does not count as a successful day.
- Advances the penalized-incomplete-day sequence.

PENALTY INCREASE:

First penalized incomplete day: ₹20.
Second penalized incomplete day: ₹40.
Third penalized incomplete day: ₹60.
Fourth penalized incomplete day: ₹80.

Continue increasing by ₹20.

A grace-protected zero-activity day must not increase this sequence.

FORMULA:

target = daily target
completed = unique counted completions
shortfall = target - completed

currentRate = startingPenalty +
              (penalizedIncompleteDayIndex - 1) * increment

For partial completion:

penalty = currentRate * shortfall / target

For zero completion after grace exhaustion:

penalty = currentRate

For zero completion with grace remaining:

penalty = 0

For full completion:

penalty = 0

EXAMPLE:

Daily target = 4.
Starting penalty = ₹20.

Completion       Penalty
4/4              ₹0
3/4              ₹5
2/4              ₹10
1/4              ₹15
0/4              Grace day if available

If the next penalized incomplete day uses a ₹40 rate:

3/4              ₹10
2/4              ₹20
1/4              ₹30
0/4              ₹40 after grace exhaustion

MONEY PRECISION:

Use integer paise, never floating-point arithmetic for currency.

Use deterministic round-half-up calculations:

penaltyPaise =
roundHalfUp(currentRatePaise * shortfall / target)

The test suite must verify all examples.

VIRTUAL PENALTY DISPLAY:

Display:
- Today's virtual penalty.
- Total accumulated virtual penalty for the challenge.
- Total accumulated virtual penalty across all challenges.
- Highest daily penalty.
- Average daily penalty.
- Penalty history.
- Penalty trend.

These are analytics only.

Do not implement any wallet or money movement abstraction.

==================================================
9. STREAK SYSTEM
==================================================

Keep DSA streak and challenge progress separate.

DSA STREAK:

A DSA streak increases when the full daily target is completed.

A partial day breaks the streak.

A zero-activity grace day breaks the DSA streak.

A zero-activity penalized day breaks the DSA streak.

Show:
- Current streak.
- Longest streak.
- Total successful DSA days.
- Total incomplete days.
- Total problems solved.
- Weekly completion rate.
- Monthly completion rate.

Never count grace days as completed DSA days.

Do not manipulate streaks to make statistics look better.

==================================================
10. DATE AND TIME RELIABILITY
==================================================

The default timezone is Asia/Kolkata.

Use reliable timezone-aware calendar calculations.

Do not use naive timestamp comparisons for daily challenges.

Store timestamps in UTC and derive challenge calendar dates
using the challenge's IANA timezone.

Handle:
- Midnight boundaries.
- Browser restart.
- Computer shutdown.
- Chrome closed overnight.
- Missed alarms.
- Delayed integration events.
- Duplicate finalization attempts.
- Historical challenges.
- Timezone changes.

The source submission timestamp must determine which challenge
day a completion belongs to, not merely the time at which
the extension discovers it.

If late-arriving verified data changes an earlier day's result,
recompute dependent virtual penalties deterministically and
keep an audit record.

Do not double-charge a day.

Use persistent storage.

Never depend on an in-memory timer or a service worker
remaining alive.

==================================================
11. LOCAL-FIRST DATA STORAGE
==================================================

There must be no backend initially.

No account registration.

No login system.

No cloud sync.

Use a reliable local database.

Recommended:
- IndexedDB.
- Dexie, if justified.
- Chrome storage API for lightweight settings.

Create a versioned data schema.

Suggested entities:

1. Challenge
2. ChallengeDay
3. Problem
4. ProblemCompletion
5. CanonicalProblemMapping
6. ManualCompletion
7. PenaltyRecord
8. StreakSnapshot
9. NotificationSetting
10. IntegrationSetting
11. AuditEvent

Create migrations from the beginning.

Add:
- Data export to JSON.
- Data import from a validated backup.
- Duplicate backup detection.
- Schema version validation.
- Recovery and migration tests.

Do not silently destroy user data.

Do not request unlimitedStorage unless there is a
documented technical reason.

==================================================
12. USER INTERFACE AND DESIGN
==================================================

Create a premium, polished, modern Chrome extension.

Visual direction:
- Linear.
- Raycast.
- Arc.
- Modern fintech dashboards.

Design requirements:
- Premium dark mode by default.
- Optional light mode.
- Deep neutral backgrounds.
- Restrained emerald accent.
- Subtle blue/violet secondary accents.
- Excellent typography.
- Consistent spacing.
- Smooth but restrained animations.
- Accessible color contrast.
- Excellent empty states.
- Loading skeletons.
- Useful error messages.
- Responsive layouts.
- Keyboard navigation.

Avoid generic template-looking dashboards.

Avoid excessive gradients.

Avoid unnecessary cards.

Avoid fake charts and fake achievements.

Every displayed metric must come from actual application data.

MAIN INTERFACES:

A. EXTENSION POPUP

Show:
- Current streak.
- Today's target.
- Today's progress.
- Challenge status.
- Remaining grace days.
- Today's virtual penalty or potential penalty.
- Quick link to full dashboard.

B. FULL DASHBOARD / SIDE PANEL

Show:
- Daily DSA progress.
- Platform breakdown.
- Verified versus manual completions.
- Current challenge.
- Streak overview.
- Virtual penalty statistics.
- Daily and weekly progress.

C. CHALLENGE SETUP

Show:
- 7-day / 30-day choice.
- Daily target selector.
- Penalty configuration.
- Grace-day policy.
- Deadline.
- Timezone.
- Clear challenge summary.
- Confirmation before starting.

D. HISTORY

Show:
- Calendar heatmap.
- Daily completion.
- Problem history.
- Challenge history.
- Streak history.
- Virtual penalty ledger.

E. SETTINGS

Show:
- Integration settings.
- Manual completion settings.
- Notification settings.
- Timezone.
- Daily target reminders.
- Theme.
- Export/import.
- Reset options with confirmation.

F. INTEGRATIONS

Show:
- LeetCode status.
- Striver A2Z status.
- Last successful detection.
- Automatic/manual tracking distinction.
- Integration health.
- Troubleshooting instructions.

==================================================
13. NOTIFICATIONS AND REMINDERS
==================================================

Implement optional reminders.

Examples:
- Daily target not started.
- Target partially completed.
- Target completed.
- Deadline approaching.
- Challenge completed.

Allow configuration of:
- Reminder time.
- Notification enable/disable.
- Deadline reminder.
- Daily summary.

Avoid excessive notifications.

Notifications must not be sent repeatedly for the same event.

==================================================
14. TECHNOLOGY STACK
==================================================

Evaluate and select a current, maintainable stack.

Preferred direction:

Chrome Manifest V3.
React.
TypeScript with strict mode.
Vite-based tooling or WXT if it is currently maintained
and provides a clear advantage.
Tailwind CSS.
shadcn/ui selectively.
Zustand if application state requires it.
Zod for validation.
IndexedDB with Dexie if suitable.
Vitest.
React Testing Library.
Playwright or an appropriate Chrome extension browser
testing setup.
ESLint.
Prettier.
GitHub Actions.

Do not add libraries just because they are popular.

Research the currently supported versions before selecting
dependencies.

Record the selected versions and reasoning.

Avoid unnecessary dependency bloat.

==================================================
15. ARCHITECTURE AND CODE QUALITY
==================================================

Keep clear boundaries:

- UI layer
- Domain/business logic
- Browser/Chrome API layer
- Website integration adapters
- Persistence layer
- Notification layer

Penalty calculations must not live inside React components.

Streak calculations must not live inside UI components.

Integration code must not directly mutate unrelated application state.

Use clear domain types.

Use Zod at external data boundaries.

Use strict TypeScript.

Avoid:
- any
- duplicated business logic
- giant components
- giant service classes
- circular dependencies
- hidden global state
- magic numbers
- silent exception handling
- unnecessary abstractions

Use small, understandable modules.

Every important domain operation should be independently
testable.

==================================================
16. CHROME EXTENSION SECURITY
==================================================

Use Manifest V3.

Follow current Chrome extension security requirements.

Request minimum permissions.

Use precise host permissions for only the websites that
actually require them.

Do not request:
- all-sites access without justification
- browsing history
- screen capture
- desktop capture
- debugger access
- unrelated permissions

Do not collect unrelated browsing data.

Do not add remote executable JavaScript.

Treat website DOM data as untrusted.

Validate messages between content scripts and extension pages.

Do not expose internal database operations to arbitrary
page scripts.

Service worker state must survive worker termination.

Review every permission and explain why it is required.

==================================================
17. TESTING REQUIREMENTS
==================================================

Testing is mandatory.

UNIT TESTS:

- Daily target completion.
- Partial completion.
- Zero completion.
- Grace-day use.
- Grace exhaustion.
- Penalty progression.
- Proportional calculations.
- Currency rounding.
- Streak calculation.
- Challenge pass/fail.
- Deduplication.
- Manual-to-verified upgrades.
- Timezone boundaries.

INTEGRATION TESTS:

- IndexedDB persistence.
- Schema migrations.
- Website adapters.
- Duplicate submission handling.
- Service worker messaging.
- Notification idempotency.
- Historical recalculation.
- Backup and restore.

END-TO-END TESTS:

- First installation.
- Onboarding.
- Starting a challenge.
- Tracking problems.
- Completing the daily target.
- Partial completion.
- Using grace days.
- Exhausting grace days.
- Completing a challenge.
- Reviewing virtual penalties.
- Exporting and importing data.

TEST EDGE CASES:

- Target = 1.
- Large daily target.
- Duplicate LeetCode submissions.
- Same problem from both platforms.
- Manual and automatic record for the same problem.
- Completion received after deadline.
- Browser closed at midnight.
- Service worker restart.
- Chrome restart.
- Missing website selectors.
- Website layout changes.
- Empty database.
- Corrupt backup file.

Never modify or weaken tests just to make the build pass.

==================================================
18. REPOSITORY DOCUMENTATION
==================================================

Maintain these documents:

CLAUDE.md
README.md
PROJECT_STATUS.md

docs/PRD.md
docs/ARCHITECTURE.md
docs/DOMAIN_MODEL.md
docs/INTEGRATIONS.md
docs/SECURITY.md
docs/TESTING.md
docs/DATA_MODEL.md
docs/ROADMAP.md

docs/decisions/

Keep CLAUDE.md concise.

Use it for:
- Project purpose.
- Commands.
- Architecture boundaries.
- Coding rules.
- Testing expectations.
- Critical constraints.

Store detailed product requirements in docs/PRD.md.

Never rely on conversation history as the sole source
of project requirements.

==================================================
19. DEVELOPMENT WORKFLOW
==================================================

Work using a controlled engineering workflow.

PHASE 0: DISCOVERY AND PLANNING

Do not write application code.

Investigate:
- Actual LeetCode integration options.
- Actual Striver A2Z tracking options.
- Cross-platform deduplication.
- Chrome Manifest V3.
- Current browser APIs.
- Local data architecture.
- Challenge state machine.
- Penalty state machine.
- Security.
- Testing feasibility.

Produce an architecture proposal and identify all uncertainties.

Do not claim an integration works until tested.

PHASE 1: FOUNDATION

Set up the repository and extension framework.

Create:
- Manifest.
- Build configuration.
- TypeScript configuration.
- React application.
- Popup.
- Side panel or full dashboard.
- Shared design system.
- Basic routing.
- Linting.
- Testing setup.

PHASE 2: DATA AND DOMAIN

Implement:
- IndexedDB.
- Schema.
- Migrations.
- Challenge domain.
- Daily progress domain.
- Penalty calculations.
- Streak calculations.
- Unit tests.

PHASE 3: CHALLENGE EXPERIENCE

Implement:
- Onboarding.
- Challenge setup.
- Starting and completing challenges.
- Daily progress.
- Challenge dashboard.
- History.

PHASE 4: INTEGRATIONS

Implement LeetCode adapter.

Implement Striver adapter.

Implement canonical problem mapping.

Implement manual fallback.

Test integrations on the actual websites.

PHASE 5: ACCOUNTABILITY EXPERIENCE

Implement:
- Streak dashboard.
- Virtual penalty history.
- Analytics.
- Calendar heatmap.
- Notifications.
- Integration status.

PHASE 6: PRODUCTION HARDENING

Implement:
- Error recovery.
- Service worker recovery.
- Backup and restore.
- Performance checks.
- Accessibility.
- Security review.
- End-to-end tests.
- Production build.
- Manual Chrome installation verification.

Do not skip phases.

Do not silently move to the next phase.

==================================================
20. CLAUDE CODE BEHAVIOUR
==================================================

Follow these rules throughout the project:

1. Inspect the repository before editing files.

2. Do not assume files or architecture exist.

3. Ask before overwriting important user files.

4. Use Plan Mode for major architectural changes.

5. Use test-driven development for domain logic.

6. Write tests before implementing important calculations.

7. Run tests after every meaningful implementation.

8. Run TypeScript, lint, tests and production build.

9. Inspect the Git diff.

10. Explain every important architectural decision.

11. Use subagents only for independent research or review.
    Do not let multiple agents edit the same files.

12. Avoid installing unnecessary MCP servers, plugins,
    skills or dependencies.

13. Do not create elaborate agent configurations without
    a demonstrated need.

14. Do not use broad automatic tool permissions.

15. Do not run destructive Git commands without my approval.

16. Do not automatically push to a remote repository.

17. Do not make fake APIs or mock production integrations.

18. Do not create fake analytics in production.

19. Do not claim tests passed unless they actually ran.

20. Report exact blockers honestly.

21. Keep PROJECT_STATUS.md updated after each approved phase.

22. Preserve existing work and data.

23. Stop if an important product requirement is ambiguous.
    Report the ambiguity rather than inventing business rules.

==================================================
21. REQUIRED OUTPUT AFTER EVERY PHASE
==================================================

At the end of each phase, provide:

1. What was implemented.
2. Files created.
3. Files modified.
4. Architecture decisions.
5. Commands executed.
6. Actual test results.
7. Production build result.
8. Known bugs.
9. Remaining limitations.
10. Acceptance criteria not yet met.
11. Git diff summary.
12. Recommended next phase.

Do not call a phase complete merely because code was generated.

A phase is complete only when its acceptance criteria
are implemented and verified.

==================================================
22. YOUR IMMEDIATE TASK
==================================================

WE ARE CURRENTLY IN PHASE 0.

Do not implement the extension yet.

First:

1. Inspect the current repository.
2. Research actual LeetCode integration options.
3. Research actual Striver A2Z integration options.
4. Research Chrome Manifest V3 requirements.
5. Evaluate the recommended technology stack.
6. Design the domain and data model.
7. Design challenge and penalty state machines.
8. Design cross-platform deduplication.
9. Identify website integration risks.
10. Create an implementation roadmap.

If independent research agents are available, use them for
separate read-only investigations.

Use official documentation wherever possible.

Clearly distinguish:
- Verified facts.
- Technical assumptions.
- Unresolved questions.
- Proposed implementation decisions.

YOUR PHASE 0 RESPONSE MUST CONTAIN:

A. Product requirements summary.
B. Proposed architecture.
C. Architecture diagram.
D. Proposed project folder structure.
E. Domain model and database schema.
F. Challenge state machine.
G. Penalty calculation examples.
H. LeetCode integration feasibility.
I. Striver integration feasibility.
J. Deduplication strategy.
K. Security and permission analysis.
L. Test strategy.
M. Development phases with acceptance criteria.
N. Risks and unresolved questions.

Do not write application code yet.

Present the complete proposal for my review.

STOP after Phase 0.

Wait for my approval before creating the project
implementation.

```
