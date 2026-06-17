# lil' bird — day / night prototype

Standalone homepage experiment: **same content & wiring** as live `lilbird.life`, with a **toggle between night (embers + gold) and day (paper + CMYK halftone + seeds)**.

**Does not replace** anything in `lilbird site/` until you approve. See **`DEPLOY-CHECKLIST.md`** for staging + go-live steps.

**QA build:** `v1.0.0-20260617-qa` — hero images verified, GTM wired, bugs fixed (see checklist).

## Folder

```
lilbird-daynight/
  index.html          ← full homepage prototype
  images/hero/        ← day-mode hero illustrations (from light v2)
  css/
    tokens.css        ← dark + light semantic variables
    site.css          ← layout & components
    chat.css          ← themed chat widget
  js/
    theme.js          ← toggle, wipe animation, logo swap, localStorage
    site.js           ← particles, carousel, pathfinder, beehiiv, nav
    chat.js           ← same chat worker as live site
```

## Preview locally

From this folder:

```bash
cd "/Users/lukehaythorpe/Library/Mobile Documents/com~apple~CloudDocs/_LLC Buisiness Files/Lil' Bird/lilbird-daynight"
python3 -m http.server 8765
```

Open http://localhost:8765 — use the **sun/moon toggle** in the nav (right side).

Assets (photos, testimonials, pathfinder images) load from **https://lilbird.life/** so you need network access. Chat + First Flight scripts also load from live site.

## What toggles

| Night (dark) | Day (light) |
|--------------|-------------|
| Charcoal + gold embers | Cream paper + floating seeds |
| Crosshatch + constellation hero art (CSS) | Balloons + sketch kids illustration (light v2) |
| Soft cinematic nav | CMYK stripe + bold ink borders |
| Gold / ember / warm hover accents | Full CMYK hover on recognition + pathfinder |
| Gold bird logo | Teal bird logo |
| Playfair + DM Mono | + Space Mono on labels |
| CMYK wipe animates on switch | same |

Choice persists in `localStorage` key `lilbird-theme`.

## Wiring preserved

- All CTAs → live lilbird.life URLs (book, Inner Compass, Nest, Calendly, etc.)
- Testimonial carousel
- Pathfinder scroll-sync visuals
- Beehiiv newsletter lazy-load
- Site chat → `lilbird-chat` worker
- First Flight booking modal via `first-flight-booking.js`

## Polish pass (prototype)

- Luke head photo: square frame (`aspect-ratio: 1/1`, `object-fit: cover`)
- Testimonial carousel: same flex/min-width math as live site
- Pathfinder: sticky image sync tuned; breakpoint aligned (desktop ≥961px)
- Light mode: CMYK hover colors on recognition grid + pathfinder rows
- Dark mode: subtle crosshatch ambient layer + gold/ember hover variety (no CMYK)
- Hero: theme-specific art — night = orbs + constellation; day = balloons + kids from light v2 (`images/hero/`)

## Next steps (when ready)

1. Port token approach into main `index.html` (optional — only if you love this)
2. Extend tokens to `book.html`, `format.html`, etc.
3. Remove `noindex` and deploy to a subdomain (e.g. `preview.lilbird.life`) for feedback
4. Inner Compass / Nest can stay dark-only longer — product surfaces are a separate pass

## Notes

- `index.html` is marked **noindex** — for prototype only
- Light mode based on your `lilbird-light-v2.html` aesthetic (halftone, CMYK, poster borders)
- Live site unchanged
