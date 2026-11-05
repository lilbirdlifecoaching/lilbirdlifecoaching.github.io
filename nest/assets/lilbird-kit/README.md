# Lil’ Bird Nest — Layered Illustration Kit v2

This is a **layered source kit**, not a finished UI. It was extracted from new watercolor asset boards and the approved day/night companion panorama.

## Important quality notes
- **No baked-in UI text should be used.** Navigation, member names, buttons, cards and progress remain live HTML/CSS.
- `backgrounds/` are opaque watercolor landscape strips. They are intentionally separate from UI. Their original painted source is a short panorama; don't stretch vertically. Use CSS cover/background color and review cropping.
- `companions/companions-group-on-gold` is an opaque extracted vignette. `companions-group-soft-edge` and `approved-companions-*-blended` have transparent **feathered rectangular edges**, NOT clean isolated silhouettes. Gold/landscape halos may remain. **Do not claim these are finished transparent cutouts.**
- `panels/` are textured paper samples with approximately masked edges. For production responsiveness, prefer CSS backgrounds and clip/mask for flexible panel sizes. Do not stretch the torn-paper textures until they look blurry.
- `botanicals/`, `icons/`, `accents/` contain extracted alpha from generated sheet backgrounds. Their edges and halos need visual QA on both themes; some will need manual cleanup.
- Many small icons are 60–200px source illustrations. Use at native/small size. They are not scalable SVG.
- `references/` contains flattened mockups and source sheets **for visual comparison only**. Never place a reference mockup as a website background.
- For consistent approved character identity, the original `backgrounds/approved-original-day/night` remain the highest-fidelity character compositions.

## Recommended layers
1. Opaque day/night landscape background on Nest shell, with page-color fallbacks.
2. Actual responsive HTML sidebar, headings, Next Chapter content, buttons and secondary cards.
3. Parchment treatment on live content containers, with high contrast.
4. Character vignette, independently positioned at right; use the approved original until a clean silhouette master exists.
5. Botanicals, tree canopy, flowers, cloud/star wash, trail and icon accents as independent decorative elements.
6. Mobile: reduce layers, don't hide content, never allow horizontal overflow; five entitled tabs must fit at 360px.

## Suggested PR process
Keep PR #40 unmerged. Create a visual prototype using these assets and show day/night desktop and mobile screenshots before implementation. Preserve entitlements, Journey data, Solo progress and all live functionality.

## Asset inventory
See `manifest.json` for names, dimensions, transparency and quality notes. Each asset is available as PNG and optimized WebP.
