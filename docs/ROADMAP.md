# Roadmap

## Done (v1)

Phases 0–6: planning; foundation; domain + IndexedDB; challenge experience; LeetCode by username + Striver sheet ticks; accountability design, history, reminders, settings; hardening (backup/restore, reset, recovery, accessibility, performance, security review).

## Waiting on the owner

- Live checks in docs/INTEGRATIONS.md: LeetCode request from the extension origin; a sheet tick while signed in to takeUforward.

## Candidates

- takeUforward judge "Accepted" detection (needs a signed-in recon session).
- LeetCode fallback via a same-origin content script, only if extension-origin requests are refused.
- Smaller bundle: move validation to `zod/mini` (≈ 15–20% of JS).
- Chrome Web Store packaging (privacy policy from SECURITY.md, screenshots).
- Optional encrypted backup file.
