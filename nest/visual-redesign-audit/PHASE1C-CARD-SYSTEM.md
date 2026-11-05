# Nest Phase 1C — Illustrated card system

**Branch:** `nest/phase1b-illustrated-world` (PR #41)  
**Status:** Visual review — **do not merge.**

## Asset audit (what the kit already had)

### Used now for cards
| Role | Asset | Notes |
| --- | --- | --- |
| Chapter silhouette + fill | `panels/parchment-hero-large.webp` | Deckled organic edges via CSS mask |
| Chapter paper grain | `textures/paper-sample.webp` | Warm tonal wash under content |
| Context inset paper | `panels/parchment-hero-small.webp` | Soft journal well |
| Context leaf mark | `icons/leaf-mini.webp` | Marks “Where you left off” |
| Chapter corner botanical | `accents/golden-leaf-sprig.webp` | Top-left, concept #3 placement |
| Life Canvas art | `icons/folded-map-watercolor.webp` | Prominent destination illustration |
| Solo Course art | `icons/open-book-watercolor.webp` | Prominent destination illustration |
| My Guide art | `icons/lantern-watercolor.webp` | Larger lantern focal |
| Nest / membership art | `icons/nest-watercolor.webp` | Non-owner third card |
| Secondary panels | `panels/paper-card-a/b/c.webp` | Distinct panel per card kind |
| Membership panel | `panels/parchment-card-portrait.webp` | Alternate portrait parchment |
| Rail panel | `panels/paper-sidebar-tall.webp` + `textures/paper-sample.webp` | Tall parchment mask |

### Available but still unused (optional future polish)
- `panels/parchment-hero-horizontal.webp`, `paper-wide.webp` — alternate chapter frames
- `botanicals/branch-gold.webp`, `branch-olive.webp`, `pale-leaves.webp` — extra corner flora (pale-leaves has dark plate/halo; needs cleanup before use)
- `accents/ink-feather.webp`, `nest-eggs.webp`, `wayfinder-sign.webp` — accents (wayfinder previously collided with CTAs)
- `icons/mountains-watercolor.webp`, `winding-trail.webp`, `compass-watercolor.webp` — alternate Life Canvas motifs
- Dedicated 9-slice / corner-only deckle strips — **missing**; flexible cards must stretch fixed panel masks

### Missing / limitations to report
1. **No true responsive deckled border kit** (corner pieces or 9-slice). Organic edges come from stretching fixed panel alphas.
2. **No dedicated “journal inset” panel** beyond small parchment samples — context well is composed from `parchment-hero-small` + CSS.
3. Icon sheets still carry **soft extraction glow** on black; inspected at Nest sizes and acceptable for review.

## Composition changes
- Desktop: chapter + companions side-by-side; companions remain a major right-side anchor
- Mobile: companions occupy their **own band** between chapter and secondary cards — **no negative-margin overlap / head clipping**
- Day and night share the same warm parchment card language

## Screenshots
`nest/visual-redesign-audit/phase1c-cards/`  
Compare against: `docs/.../references/approved-concept-3-day.png` and `night-reference.png`
