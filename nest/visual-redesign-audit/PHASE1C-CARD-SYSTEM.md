# Nest Phase 1C — Illustrated card system

**Branch:** `nest/phase1b-illustrated-world` (PR #41)  
**Status:** Visual review — **do not merge.**

## Parchment artifact root cause (confirmed)

1. **`textures/cream-grain.webp` is a 57×70 circular stamp**, not a seamless tile. Phase 1C tiled it (`background-repeat: repeat` at 140–160px) as `--paper-fill` on the rail, chapter, and secondary cards → pale polka-dot grid + seams.
2. **Full-card CSS masks** stretched fixed panel alphas (`parchment-hero-large`, `paper-card-*`, `paper-sidebar-tall`) beyond intended proportions, soft-masking interiors and letting landscape show through as rectangular transparency patches.
3. **Page `::before`** also tiled the same cream-grain stamp over the Nest shell.
4. **Mobile flat beige band:** `background-size: 140% auto` sized the valley panorama to ~viewport width with height from aspect ratio (~144px), so only a short top strip painted; the rest of the scroll filled with solid `background-color`.

**Correction:** Removed all cream-grain tiling and full-card masks. Cards/rail/Journey/side panels use fully opaque warm parchment CSS fills (no texture images — `paper-sample.webp` bright-center wash also read as pale circles). Deckled panel images are not used as scalable masks. Corner leaf accents remain as separate artwork. Mobile landscape uses `background-size: cover`.

## Asset audit (what the kit already had)

### Used now for cards
| Role | Asset | Notes |
| --- | --- | --- |
| Card / rail / Journey / sidebar fill | CSS `#fff8e8` + soft vertical wash | Fully opaque; no mask; no texture image |
| Context leaf mark | `icons/leaf-mini.webp` | Marks “Where you left off” |
| Chapter corner botanical | `accents/golden-leaf-sprig.webp` | Top-left, concept #3 placement |
| Life Canvas art | `icons/folded-map-watercolor.webp` | Prominent destination illustration |
| Solo Course art | `icons/open-book-watercolor.webp` | Prominent destination illustration |
| My Guide art | `icons/lantern-watercolor.webp` | Larger lantern focal |
| Nest / membership art | `icons/nest-watercolor.webp` | Non-owner third card |
| Valley / companions | `backgrounds/nest-valley-*.webp`, companion cutouts | Full-bleed world + staged characters |

### Intentionally unused as full-card masks (do not stretch)
- `panels/parchment-hero-large.webp`, `paper-card-a/b/c.webp`, `paper-sidebar-tall.webp`, `parchment-card-portrait.webp`
- `textures/cream-grain.webp` — circular stamp; never tile

### Available but still unused (optional future polish)
- `panels/parchment-hero-horizontal.webp`, `paper-wide.webp` — alternate chapter frames
- Dedicated 9-slice / corner-only deckle strips — **missing**; flexible cards must not stretch fixed panel masks
- `botanicals/*`, extra accents — optional after cleanup

### Missing / limitations to report
1. **No true responsive deckled border kit** (corner pieces or 9-slice). Organic edges are deferred until corner art exists.
2. Context well is a ruled note on the same parchment (leaf mark + top rule), not a nested card.
3. Icon sheets still carry soft extraction glow; inspected at Nest sizes and acceptable for review.

## Composition changes
- Desktop: chapter + companions side-by-side; companions remain a major right-side anchor
- Mobile: companions occupy their **own band** between chapter and secondary cards — **no negative-margin overlap / head clipping**; landscape continues behind them via `cover`
- Day and night share the same warm parchment card language

## Screenshots
`nest/visual-redesign-audit/phase1c-cards/`  
Compare against: `docs/.../references/approved-concept-3-day.png` and `night-reference.png`
