# Lil’ Bird Nest — layered artwork handoff

Generated from the approved `approved-concept-3-day.png` and `night-reference.png` in the repository, using the built-in OpenAI image-generation tool. These are original PNG masters at the returned resolution, without artificial upscaling. This is an asset handoff only: no site code, production assets, or deployments were changed.

## Files

| File | Dimensions | Purpose |
| --- | --- | --- |
| 01-backdrop-day.png | 1774 × 887 | Edge-to-edge day scenery, no people/UI |
| 02-backdrop-night.png | 1774 × 887 | Matching moonlit scenery, no people/lantern/UI |
| 03-companions-day.png | 1254 × 1254 | Transparent children, backpack/plush chick, rocks and flowers |
| 04-companions-night.png | 1254 × 1254 | Matching transparent companions, moonlight and lantern |
| 05-meadow-day.png | 2172 × 724 | Transparent foreground strip, tall edges/low center |
| 06-meadow-night.png | 2172 × 724 | Matching moonlit foreground strip |
| 07-spot-mountains.png | 1254 × 1254 | Transparent mountain/pine spot |
| 08-spot-book.png | 1254 × 1254 | Transparent open book, green sprigs, yellow flower; blank pages |
| 09-spot-lantern.png | 1254 × 1254 | Transparent lantern with wildflowers |
| 10-spot-nest.png | 1254 × 1254 | Transparent woven nest with three speckled eggs |

## Validation

- Visually inspected every generated output: no UI, cards, menus, logos, labels or signatures observed.
- All eight cutouts verified as RGBA with fully transparent and opaque pixels. Black shown behind some previews represents transparency, not a black canvas.
- Main painted silhouettes remain inside the canvas; very faint low-alpha watercolor pixels can extend farther than the visible shape. Preserve the original alpha; do not remove black or white by color key.
- Day/night pairs have matching canvas dimensions and closely matched placement. Night variants were generated as lighting edits of their day counterparts. They are not guaranteed pixel-identical silhouettes; prefer a theme swap or test any crossfade for ghosting.
- Rejected the first mountain output because it had a diffuse halo. Included the corrected clean silhouette only.
- Character identity/style was guided by both approved references. Final character fidelity remains a visual approval decision.

## Implementation notes

1. Keep these PNGs as source masters. Make optimized WebP/AVIF derivatives separately if needed, preserving alpha and original filenames in the manifest mapping.
2. Stack scenery at the bottom, live HTML panels above it, companions as their own positioned image, meadow as an optional foreground layer. Foreground decorations should use pointer-events: none and never obscure controls.
3. Desktop companions: use `object-fit: contain`, reserve aspect-ratio 1/1, keep complete heads/boots/rocks. A rendered width around 480–620 CSS px is a reasonable starting point; inspect the actual layout at 100% zoom. Do not use this entire square cutout as a full-screen background.
4. On mobile, give companions their own scene band and retain full figures; move the meadow separately. Use the backdrop behind that band, avoiding the old short-painted-strip/flat-beige-band defect.
5. The 2:1 backdrop is a scene, not a repeating texture. Use `no-repeat`, choose crop/position per breakpoint, and avoid stretching. At very wide/high-density screens it is not a native 4K background. The independent companion and meadow layers keep focal details sharper.
6. Do not tile any PNG, use artwork as a full-card mask, or bake buttons/text into it. Card interiors should be opaque readable HTML surfaces with independent decorative art.
7. Spots have transparent margins. Size by the visible artwork, especially the mountains, whose painting occupies a shallow central band. Do not stretch it vertically to fill a card.
8. These assets are decorative: use alt="" where live content already carries meaning. Preserve real brand logo, user avatar, auth, entitlements, navigation, progress and saved work.
9. Validate desktop/mobile and both themes against approved references before requesting release approval. Do not merge or deploy without the user's explicit approval.

The manifest records dimensions, byte sizes, alpha data and SHA-256 checksums. PROMPTS.md records the generation specifications and edit lineage.
