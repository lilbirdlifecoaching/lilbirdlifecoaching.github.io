# Nest Phase 1B — Illustrated World Verification

**Branch:** `nest/phase1b-illustrated-world`  
**Status:** Ready for review — **do not merge until screenshot + functional approval.**  
**Base:** Phase 1 tip (PR #40) — keep #40 unmerged; this PR continues the visual track.

## What changed

Architectural shift from parchment-on-flat Nest to a **full-bleed illustrated world** (approved concept #3):

- Day/night valley landscape as the Nest page background (`data-theme` unchanged)
- Layered botanicals / canopy / stars / rocks as non-interactive decor
- Companions staged **outside** the Next Chapter panel (right of parchment on desktop; below on mobile)
- Parchment treatment on rail, Next Chapter, and secondary cards (warm parchment retained at night)
- Watercolor card icons from the v2 kit
- Mobile rearrangement (not a scaled desktop); Solo five-tab nav preserved

## Asset quality note (needs replacement)

Do **not** treat companions as finished cutouts:

| Asset | Issue |
| --- | --- |
| `nest/assets/lilbird-kit/companions/approved-companions-day-blended.webp` | Soft feathered rectangular vignette + landscape/gold halo contamination |
| `nest/assets/lilbird-kit/companions/approved-companions-night-blended.webp` | Same soft-edge / halo issue |
| `companions-group-soft-edge.webp` / `companions-group-on-gold.webp` | Soft edge or opaque gold plate — not clean silhouettes |

No excessive blur or awkward overlays were added to hide these defects. Prefer a true transparent silhouette master when available. Highest-fidelity character identity remains in `backgrounds/approved-original-day|night` per kit README.

## Screenshots

Local fixture captures: `nest/visual-redesign-audit/phase1b-world/`

| # | File | Check |
| --- | --- | --- |
| 01 | `01-desktop-day.png` | Full landscape + parchment chapter + companions right |
| 02 | `02-desktop-night.png` | Night valley + warm parchment panels |
| 03 | `03-mobile-day.png` | 390px, no overflow, primary CTA usable |
| 04 | `04-mobile-night.png` | Night mobile |
| 05 | `05-desktop-solo-rail.png` | Solo Course on desktop rail |
| 06 | `06-mobile-solo-tab.png` | Home · Journey · Solo · Guide · More |
| 07–09 | Solo start / continue / complete | Entry-state labels |
| 10 | `10-nonowner-locked.png` | No Solo rail; locked discoverability note |
| 11 | `11-tablet-1024.png` | Mid breakpoint |
| 12 | `12-narrow-360.png` | 360px five-tab fit, no horizontal overflow |
| 13–14 | New member day | Empty-ish Next Chapter path |

Interactive fixture: `nest/phase1b-world-fixture.html`  
Source kit (docs): `docs/lilbird_nest_visual_assets_v2/lilbird_nest_asset_kit_v2/`  
Deployable kit: `nest/assets/lilbird-kit/` (~2.1MB webp layers)

## Functionality preserved

No changes to Supabase, Stripe, Worker, Solo unlock logic, Journey/Guide/AI, or Session Info. Phase 1 Solo nav + Home entry-state wiring retained (`nest-client.js` v70 cache bump only for watercolor icons / `data-kind`).

## Overflow

Capture script reported **0 horizontal overflow** at 1440 / 1024 / 390 / 360.
