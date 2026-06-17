# lilbird-daynight — deploy checklist

**Build:** `v1.0.0-20260617-qa`  
**QA date:** 2026-06-17  
**Status:** Ready for **staging preview** — not yet ready to replace `lilbird.life/` without your sign-off.

---

## Confirmed working (QA pass)

| Item | Status |
|------|--------|
| Hero images `images/hero/hero-balloons.png` (229 KB) | ✅ Present |
| Hero images `images/hero/hero-kids.png` (538 KB) | ✅ Present |
| CSS path to balloons `../images/hero/hero-balloons.png` | ✅ Resolves locally |
| 12 testimonials (matches live homepage) | ✅ |
| Beehiiv slot + lazy-load + fallback link | ✅ Wired |
| Chat → `lilbird-chat.cwwq46sn7m.workers.dev` | ✅ Wired |
| First Flight modal → `first-flight-booking.js` | ✅ Loads from live |
| `lb-chat-safe.js` sanitization | ✅ Loads from live |
| Theme toggle + `localStorage` persistence | ✅ |
| Logo swap dark ↔ teal (`bird-logo-teal.png` on live) | ✅ Live asset 200 |
| GTM head scripts | ✅ Added (`lilbird-gtm-id.js` + `lilbird-gtm.js`) |
| Nest links | ✅ Absolute `https://lilbird.life/nest/` |
| Pathfinder desktop scroll-sync | ✅ + resize re-init fix |
| Light-mode inline links | ✅ Theme-aware `.inline-link` class |
| Chat error handling | ✅ Fixed double-error message |

---

## Before staging deploy (preview URL)

Do these when pushing to e.g. `preview.lilbird.life` or a GitHub Pages preview path:

- [ ] **Upload entire `lilbird-daynight/` folder** including `images/hero/` (both PNGs)
- [ ] **Test on phone + desktop** — toggle both modes, scroll full page
- [ ] **Click-test:** carousel arrows, pathfinder rows, chat open/send, First Flight CTA, Beehiiv form
- [ ] **Keep `noindex`** on staging until you're happy (currently set — intentional)
- [ ] Optional: add basic auth or unlisted URL only

### Staging deploy options

**Option A — Subfolder on GitHub Pages**  
Copy contents into repo (e.g. `preview/` branch or `docs/preview/`) and enable Pages. URLs become `lilbird.life/preview/` — relative `css/` and `images/` paths work.

**Option B — Separate subdomain**  
Point `preview.lilbird.life` at the folder via Cloudflare Pages or GitHub Pages custom domain.

---

## Before replacing live homepage (`lilbird.life/`)

Only after you love the preview:

- [ ] **Remove `noindex`** — change to `index, follow`
- [ ] **Add full SEO head** from live `index.html`: canonical, OG/Twitter tags, JSON-LD `ProfessionalService` block
- [ ] **Switch links to relative** where appropriate (`book.html`, `deep-profile.html`, `am-i-ready-for-coaching.html`, `/nest/`) so the homepage is self-contained on the domain
- [ ] **Copy or reference assets locally:** `bird-logo.png`, `bird-logo-teal.png`, `first-flight-booking.js`, `lb-chat-safe.js`, `lilbird-gtm*.js` — or keep absolute URLs (works, but adds cross-origin dependency)
- [ ] **Merge into `lilbird site/index.html`** OR replace root `index.html` with this build + move `css/`, `js/`, `images/` to site root
- [ ] **Update chat worker context** if homepage copy/structure changed (worker may reference site sections)
- [ ] **Smoke test Nest return path** — users who toggle theme should still auth to Nest correctly
- [ ] **Announce / soft launch** — day mode is a bigger visual shift; night should feel familiar

---

## Known intentional differences (not bugs)

| Topic | Notes |
|-------|-------|
| Night hero | CSS constellation + orbs vs live embers-only — close in spirit, not pixel-identical |
| Day hero | Balloons + sketch kids from light v2 — hidden below 960px width |
| CSS architecture | External token files vs live inline `<style>` — required for theming |
| Other site pages | `book.html`, `format.html`, Nest, Inner Compass stay **dark-only** until a later pass |
| Default theme | Respects `localStorage`, else `prefers-color-scheme` |

---

## Quick local preview

```bash
cd "/Users/lukehaythorpe/Library/Mobile Documents/com~apple~CloudDocs/_LLC Buisiness Files/Lil' Bird/lilbird-daynight"
python3 -m http.server 8765
```

Open http://localhost:8765 — toggle sun/moon in nav.

---

## Manual click-test script (~10 min)

1. **Night mode** — load page, confirm embers + gold, constellation hero on desktop
2. **Toggle to Day** — CMYK wipe, cream background, teal logo, balloons/kids hero
3. **Toggle back** — logos and particles swap correctly
4. **Refresh** — theme persists
5. **Carousel** — prev/next + dots through all 12 cards
6. **Pathfinder (desktop ≥961px)** — scroll tiers, sticky image updates
7. **Pathfinder (mobile)** — tier images show inline per tier
8. **Chat** — open, send message, close; pathfinder “open chat” button works
9. **Newsletter** — scroll to section, Beehiiv iframe loads (or fallback link appears)
10. **All CTAs** — spot-check Book, First Flight, Inner Compass, Solo, Nest

---

## Files in this build

```
lilbird-daynight/
  index.html
  DEPLOY-CHECKLIST.md
  README.md
  images/hero/hero-balloons.png
  images/hero/hero-kids.png
  css/tokens.css
  css/site.css
  css/chat.css
  js/theme.js
  js/site.js
  js/chat.js
```
