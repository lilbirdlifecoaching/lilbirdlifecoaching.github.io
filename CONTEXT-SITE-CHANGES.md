# lilbird.life — site change log (context for agents & humans)

This file tracks substantive homepage and related updates so future edits stay coherent.

## 2026-05-11 — Security, abuse resistance, performance (main site)

**Goal:** Harden the public chat worker, remove XSS surface from model HTML, shrink heavy assets, defer third parties, add baseline HTTP security headers where the host supports them.

### Phase A — Client chat safety (`lb-chat-safe.js`, `index.html`, `chat.js`)

| Item | Detail |
|------|--------|
| **New file `lb-chat-safe.js`** | Shared helpers: `escapeHtml`, `isAllowedCalendlyUrl` (HTTPS `calendly.com` + path prefix `/lilbirdlifecoaching/`), `sanitizeAssistantHtml` (escapes all HTML; re-injects only whitelisted `lb-book-trigger` anchors + `span.lb-discount` with text-only inner content). |
| **`index.html`** | Loads `lb-chat-safe.js` before inline chat. `addBot()` uses `sanitizeAssistantHtml`. Calendly overlay only runs if `data-url` passes `isAllowedCalendlyUrl`. `fetch()` treats non-OK responses as hard failures with a user-safe message. |
| **`chat.js`** | If `window.lbChatSafe` is missing, embeds the **same** sanitization logic inline (keep in sync with `lb-chat-safe.js`). `openCal`, `data-cal-url` handler, and plain Calendly link handler validate URLs. `addBot` uses `Safe.sanitizeAssistantHtml`. Non-OK worker responses handled. |

### Phase B — Cloudflare Worker (`lilbird-chat-cloudflare-worker.js`)

**Deploy reminder:** paste the updated file into the Worker in the Cloudflare dashboard (or deploy via Wrangler). No change to the Anthropic secret name.

| Item | Detail |
|------|--------|
| **CORS** | `Access-Control-Allow-Origin` is **never** `*`. Only requests whose `Origin` is in the allowlist get echo ACAO + `Vary: Origin`. |
| **Allowlist** | Default origins: `https://lilbird.life`, `https://www.lilbird.life`, `http://localhost:8788`, `http://127.0.0.1:8788`, `http://localhost:5500`, `http://127.0.0.1:5500`. Override with Worker env **`ALLOWED_ORIGINS`** (comma-separated). |
| **403** | Missing or non-whitelisted `Origin` on POST → `403` `{ "error": "forbidden" }` (no stack traces). |
| **Payload limits** | Max body ~96KB; max 24 messages; max 10k chars per message; total content length cap ~80k before upstream call. |
| **Upstream errors** | Non-OK Anthropic response → `502` `{ "error": "upstream_unavailable" }` (body not forwarded to client). Other catch → `500` `{ "error": "server_error" }`. |

### Phase C — `_headers`, sitemap, homepage UX

| File | Detail |
|------|--------|
| **`_headers`** | For **Cloudflare Pages** (and similar): `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`. **GitHub Pages alone ignores this file** — set equivalent headers in Cloudflare (Transform Rules) or your CDN if needed. |
| **`sitemap.xml`** | Added `about-luke.html`, `articles/how-do-you-know-youre-ready-for-life-coaching.html`; kept existing URLs including `am-i-ready-for-coaching.html`. |
| **`index.html` — Beehiiv** | Embed removed from initial HTML; **`#beehiiv-slot`** loads `embed.js`, iframe, and `attribution.js` only when the slot intersects the viewport (`IntersectionObserver`, `rootMargin: 140px`). |
| **`index.html` — embers** | Particle creation skipped when `prefers-reduced-motion: reduce`; CSS hides `.embers` in that mode. |

### Phase D — Testimonial images

| File | Detail |
|------|--------|
| **`Testimonials/Wanda-L-web.jpg`** | Max dimension 512px; replaces 7MB+ `Wanda-L.JPG` in carousel (`index.html` src updated). Original JPG left in repo for archival. |
| **`Testimonials/Confidence-U-web.jpg`**, **`Deb-B-web.jpg`** | Max width 480px + JPEG q~70; `index.html` updated. Original PNGs retained. |

### Operational checklist

1. **Redeploy the Worker** after pulling `lilbird-chat-cloudflare-worker.js`. Set **`ALLOWED_ORIGINS`** in production if you use a staging hostname not in the default list.  
2. **Deploy static files** including `lb-chat-safe.js`, `_headers` (if using Cloudflare Pages), new `Testimonials/*-web.jpg`, and `index.html` / `chat.js`.  
3. **Cloudflare dashboard:** consider **Rate Limiting** / **Bot Fight** on the worker route (not expressible in repo alone).  
4. **Strict CSP** with nonces was **not** added — it would break extensive inline script/style until a build pipeline exists.

---

## 2026-05-10 — Calendly account slug

All booking URLs use **`https://calendly.com/lilbirdlifecoaching/...`** (replaced former `lukehaythorpe-orangery`). Updated: `index.html`, `book.html`, `format.html`, `about-luke.html`, `assessment.html`, `am-i-ready-for-coaching.html`, `chat.js`. (`deep-profile.html` / worker assets were already on `lilbirdlifecoaching`.)

**Cloudflare chat AI worker:** Source of truth in repo is **`lilbird-chat-cloudflare-worker.js`** — paste the full file into the Worker (not `chat.js`, which is the browser widget). Prompt includes Solo course + Life Change Intensive naming; `node --check` clean.

## 2026-05-10 — Phase: narrative, pathfinder, naming, Luke page

### Strategy
- **Life Change Intensive** = full **in-person** multi-session package (book via `book.html`, Calendly package). Distinct from **Life Change Sessions: Solo Course** at `https://lilbird.life/solo/`.
- **Pathfinder** section (`#pathfinder`) maps every front door: Am I Ready, Inner Compass, Solo, First Flight, Intensive, Discovery — without duplicating the long “acts” story.
- **Acts** tightened: Act 1 no longer repeats hero copy; Act 3 values reduced to three concrete promises; Act 4 headline/copy specific.
- **Testimonials**: life-coaching / transition quotes first; executive/leadership proof after. Optional portrait slots documented below.
- **Chat**: floating hint above the widget button (short line + arrow); widget behavior unchanged.
- **Luke**: new **`about-luke.html`**; Meet Luke CTA points here instead of Orangery.

### Files touched
| File | What changed |
|------|----------------|
| `index.html` | Hero + secondary CTA `#pathfinder`; new **pathfinder** section (all doors + chat note); Act 1–4 copy (cohesive arc, less generic); engage-strip after approach; values → 3 concrete promises; Act 4 offerings: First Flight, Intensive, Solo, Monthly, Discovery, community; testimonials reordered (coaching clients first) + role lines; newsletter/discovery/final copy; footer **About Luke**; Meet Luke → `about-luke.html`; chat **launcher** hint (“Questions? He knows this site cold.”) + `pathfinder-chat-trigger` |
| `about-luke.html` | **New** — bio / credibility page (GiANT, ministry → coaching; Orangery link optional; CTAs) |
| `book.html` | Selector → **Life Change Intensive**; `id="intensive"`; distinguishes Solo course link in description; meta tags |
| `format.html` | Intensive vs Solo language; FAQ session-types answer |
| `CONTEXT-SITE-CHANGES.md` | This file |

### Testimonial photos (optional)
Add `testimonials/` at site root and reference in markup, e.g. `testimonials/brianna-m.jpg`. CSS class: `.testimonial-face` on an `<img>` inside `.testimonial-author` (see `index.html`). Omit `img` until files exist.

### URLs to verify after deploy
- `https://lilbird.life/solo/`
- `https://lilbird.life/book.html#intensive`
- `https://lilbird.life/about-luke.html`
