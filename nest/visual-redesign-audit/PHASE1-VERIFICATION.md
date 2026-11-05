# Phase 1 verification report

**Branch:** `nest/phase1-visual-redesign`  
**Status:** Ready for review — **do not merge until screenshot + functional approval.**

## What shipped

- Approved companion art: `nest/assets/companions-{day,night}.{webp,png}`
- Nest Home parchment / editorial Next Chapter + day/night swap
- Solo Course desktop rail (entitled only) → `/solo/`
- Mobile: entitled `Home · Journey · Solo · Guide · More` (Grow moves into More)
- Home Solo states via existing `progressSummary()` / `hasSoloCourseAccess()`:
  - Start Solo Course
  - Continue Solo Course (+ next session title)
  - View My Flight Plan
- Non-owners: no Solo rail/tab; Learn & grow remains the discoverability path

## Art composition note

Production art is an **opaque panoramic landscape** (~3.6:1), characters on the right. Nest Home uses a soft left blend + `object-position` favoring the right so faces/backpack stay visible. This is not a transparent cutout; do not treat it as one.

## Screenshots

Local fixture (production CSS + art): `nest/visual-redesign-audit/phase1-impl/`

| # | File | State |
|---|------|--------|
| 1 | `01-desktop-day.png` | Returning, day |
| 2 | `02-desktop-night.png` | Returning, night |
| 3 | `03-mobile-day.png` | Returning, day |
| 4 | `04-mobile-night.png` | Returning, night |
| 5 | `05-desktop-solo-rail.png` | Entitled Continue + rail |
| 6 | `06-mobile-solo-tab.png` | Entitled Solo tab |
| 7 | `07-solo-start.png` | New owner · Start |
| 8 | `08-solo-continue.png` | Active · Continue + session title |
| 9 | `09-solo-complete.png` | Completed · Flight Plan |
| 10 | `10-nonowner-locked.png` | Non-owner (no Solo nav) |
| — | `11-tablet-1024.png`, `12-narrow-360.png` | Responsive probes |

Interactive fixture: `nest/phase1-impl-fixture.html`

## Regression tests

**Passed (82):** account-closure, journey-focus/tools/reflect/checkin, nest-guide, canvas-access, solo-start-continue, worker-solo-access-align.

**Pre-existing failure (not introduced by this PR):**  
`nest/ownership-recovery.test.mjs` — expects assessment worker pin `v8.7.0-release-b3`; repo worker is `v8.8.0-canvas-checkin`. Unrelated to Nest visual/nav changes.

## Explicitly unchanged

Supabase, Stripe, Solo Worker auth, entitlements, course progress storage, Guide/Journey engines, Solo session UI / Info sheet / Start-Continue unlock logic.
