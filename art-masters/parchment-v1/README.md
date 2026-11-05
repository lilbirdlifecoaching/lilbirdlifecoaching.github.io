# Lil’ Bird aged parchment — artwork handoff

Seven PNG masters generated with the built-in image tool from the approved Nest day/night references. Purpose: replace plain geometric card surfaces with tactile aged ivory paper, irregular deckled edges, fine fibers, and restrained honey-colored patina. These are blank artwork layers; all text and controls stay live HTML. No site or production files were changed.

## Contents

| File | Dimensions | Intended use |
| --- | --- | --- |
| 01-parchment-hero-wide.png | 1536 × 1024 | Main chapter / hero panel |
| 02-parchment-card-square.png | 1254 × 1254 | Square secondary panel, asymmetric edge nicks |
| 03-parchment-card-landscape.png | 1448 × 1086 | Landscape secondary panel, gently sloping irregular edges |
| 04-parchment-sidebar-tall.png | 725 × 2170 | Narrow navigation rail |
| 05-parchment-mobile-page.png | 1024 × 1536 | Portrait panel / single journal page |
| 06-parchment-journal-spread.png | 1536 × 1024 | Two-page paper spread with center crease and layered lower edges |
| 07-parchment-edge-frame.png | 1254 × 1254 | Edge-only master with transparent central window, for nine-slice rendering |

## Art direction

Keep paper light and creamy in both themes, as in the approved dashboard concept. Age comes from warm edge patina, fibers, shallow corner creases and irregular silhouettes. The central reading area remains quiet. Avoid adding heavy brown filters, fake scorch damage, repeated dots, vignettes, or full-card transparency. Keep the existing botanical and spot illustrations separate.

## Important opacity finding

All seven files are RGBA and contain genuinely transparent outside pixels. Filled panel centers have alpha approximately 250–254/255, not mathematically 255 throughout. The frame's center is transparent (alpha 0–1). These are generated source assets, preserved without artificial enlargement or alpha modification.

For actual UI text areas, place a SOLID warm cream backing beneath the paper, inset safely inside its silhouette. Keep the outer deckle transparent so the scene appears around it, but prevent the landscape from bleeding through the reading area. A central starting color is `#fcecd6`; tune to the selected image under actual browser rendering. Do not use the panel alpha as a full-card mask on content or reduce card opacity.

## Scaling without destroying the edges

- Prefer `07-parchment-edge-frame.png` for variable-height or variable-width cards. It is a single frame source containing four corners and four edge regions, not nine pre-cut files. A developer can use CSS border-image or cut it into nine regions.
- Start testing source slices around **16% on all four sides**. This retains the outside corners and the inner rectangular cutout within the border zones. Rendered borders around **24–36 CSS px** are a starting point, not a validated final setting. Stretch edge regions once; do not repeat/tile them.
- Add a separate solid cream central fill underneath, overlapping the frame's inner edge by a few pixels to avoid hairline gaps. Keep that fill well inside the outer torn silhouette. Tune the overlap in the browser: the generated inner edge has a few fibers rather than a perfectly mathematical cut.
- Preserve corner proportions. Do not stretch the entire square frame as one background over a tall mobile card.
- The complete sheets are useful for compositions near their original aspect ratios. Do not force the wide hero into a very tall mobile panel; use the portrait sheet or edge frame instead.
- Whole-sheet artwork includes transparent margins and irregular shapes. Keep all live content in an inner safe region with generous padding. Avoid `cover` if it crops off the deckled edge. Reserve the panel dimensions to avoid layout shift.
- The journal spread is paper art only. Keep video, conversation and tools native; do not place a book-shaped flattened screenshot on top of working UI. Mobile should use a single page.

## Verification before release

Every image was visually inspected; no writing, logo, interface, ruled text lines or repeated circle patterns were observed. The edge frame's transparent window was checked numerically. Dimensions, alpha ranges and checksums are recorded in asset-manifest.json. The assets have not yet been integrated or browser-tested as responsive surfaces, so slice widths, overlaps, padding and contrast need verification in the actual implementation.

Check 1440px desktop, 768px tablet, 390px and 360px mobile in both themes at 100% zoom. Look for stretched corners, cropped deckle, texture seams, see-through text areas and content reaching torn margins. Preserve all existing auth, entitlement, progress, navigation, video/chat and saved-output behavior. Do not merge or deploy without the user's explicit approval.
