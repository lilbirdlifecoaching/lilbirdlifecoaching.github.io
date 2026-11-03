# Lil Bird — Claude handoff (paste at start of session)

**Repo path:** `docs/CLAUDE-HANDOFF.md` (with `docs/LILBIRD-MASTER.md` and `docs/LILBIRD-UPDATE-LOG.md`). Cloud agents and scheduled checks read the GitHub repo, not iCloud. When the iCloud originals change, copy those three files into `docs/` again before relying on them here.

**Last updated:** 2026-07-14 (First Flight Stripe → Cal.com — **built in repo, deploy pending**)  
**Purpose:** Lock Claude to the latest repo truth, deploy rules, product decisions, and what was just shipped. Treat this file as authoritative over older chat memory.

---

## How to use this with Claude

Paste the block below into a new Claude conversation (or project instructions), then attach or point Claude at this repo folder if possible.

```
You are helping Luke Haythorpe on Lil Bird (lilbird.life). Read docs/CLAUDE-HANDOFF.md first, then docs/LILBIRD-UPDATE-LOG.md and CONTEXT-SITE-CHANGES.md for depth. docs/LILBIRD-MASTER.md for ecosystem overview. Nest security and wiring also live under docs/NEST-*.md.

Rules:
- GitHub Pages = static HTML/CSS/JS only. Cloudflare Workers = paste .js from repo; never put worker code on GitHub Pages.
- Inner Compass live page = Deep-profile Cursor Project/deep-profile.html → /deep-profile.html. NOT solo/tools/tool-deep-profile.html.
- Assessment API = Cloudflare Worker lilbird-assessment (lilbird-assessment.js). Solo API = worker-solo (solo/worker-solo.js). Do not mix them.
- Supabase project for Nest/Solo auth: mebqqzbuwkogdxvnihrq only.
- Log substantive changes in LILBIRD-UPDATE-LOG.md and CONTEXT-SITE-CHANGES.md. Do not invent deploy steps; follow DEPLOY-LCI-CHECKLIST.md and DEPLOY-DAYNIGHT.md.
- Do not replace root index.html with Nest login. Nest lives under /nest/ only.
- Luke deploys manually (iCloud repo → GitHub Pages upload). There is no git deploy pipeline in daily use.
```

---

## Live version checklist (Luke verified May 2026)

| Surface | Repo build / version | How to verify live |
|--------|----------------------|-------------------|
| **Homepage** | `v1.2.0-20260528-conversion-pass` | View source on https://lilbird.life/ (comment line 2) |
| **Day/night theme bundle** | `v1.1.0-20260617-site-wide-theme` + conversion CSS | Toggle on home; Phase 1 pages follow `localStorage` key `lilbird-theme` |
| **Inner Compass HTML** | `v7.1.0-20260528-phase2-conversion` | View source or console on https://lilbird.life/deep-profile.html |
| **Assessment worker** | `v7.1.0-nest-next-discovery` (ping) | `GET https://lilbird-assessment.cwwq46sn7m.workers.dev/ping` |
| Solo shell | `v1.7-glow-compare-20260530` | Console on https://lilbird.life/solo/ |
| Solo worker | `v1.10-coaching-checkout` (repo) | `GET https://worker-solo.cwwq46sn7m.workers.dev/ping` — redeploy if ping still shows older |
| First Flight book | `/first-flight/book.html` | Stripe → `/first-flight/booked.html` → Cal.com |
| Coaching book | `/coaching/book.html` | Stripe `$249` (`price_1TssDPGAu36WZ7DdGYCWUP5m`) → `/coaching/booked.html` → Cal.com |

**Status:** Phase 1 + 2 confirmed live earlier. **First Flight pay→Cal.com** is built in repo — needs Cloudflare worker-solo paste + `STRIPE_FIRST_FLIGHT_PRICE_ID` + GitHub Pages upload of `first-flight/` and link updates.

---

## Product decisions (May 2026 — do not reverse without Luke)

These came from a 10-panel critique + Luke’s explicit choices. Claude should treat them as locked strategy unless Luke says otherwise.

| Decision | Choice |
|----------|--------|
| **Primary CTA (cold traffic)** | **Free discovery call** (`calendly.com/lilbirdlifecoaching/30min`) — not First Flight, not pathfinder |
| **First Flight booking** | **Stripe on `/first-flight/book.html`**, then **Cal.com** `luke-haythorpe/first-flight-intro-session` (no Cal payment). Price id `price_1TsqwuGAu36WZ7DdhQCViEPa`. Promo **IMREADY** → $149. Do not restore Calendly payment for First Flight. |
| **Faith / ministry** | **Texture, not feature** on homepage — listening skill without ministry branding; fuller story on `about-luke.html` |
| **Intensive pricing on site** | **Not on homepage** — scope and investment discussed on discovery call (sticker-shock avoidance) |
| **Inner Compass paywall** | **No Stripe by default** — single **email gate** → free full read + saved link (`v7.0.9+`). `?paywall=1` restores PWYW + Stripe for tests only |
| **ICP** | Stated 25–35 in transition; testimonials reordered to match; VPs/Forbes kept as secondary proof |
| **Jargon on marketing** | Keep **Inner Compass** + **First Flight**; demote Glow Map, Life Canvas, etc. to session/format copy or in-product only |

### Conversion pass — what shipped (Phase 1 + 2)

**Phase 1 — marketing site (`index.html`, `book.html`, `format.html`)**
- Hero + nav + final CTA → discovery call primary; First Flight secondary with price
- New **pricing strip** (Discovery free · First Flight $299/often $149 · Solo $197 · Intensive “on the call”)
- New **trust strip** (confidential · your data/Nest · GiANT · coaching ≠ therapy)
- Testimonials reordered: Wanda, Brianna, Mel, Anna, Deb first
- Pathfinder moved **below** story acts; reframed as “full menu” for browsers
- Act Two headline → “Two hours. Your story first.” (not generic “less advice, more listening”)
- Meet Luke → ministry as texture
- `book.html` defaults to **discovery** Calendly tab

**Phase 2 — Inner Compass (`deep-profile.html` + worker)**
- Richer **pre-email gate**: plain lead line, 2 `whoYouAre` paragraphs, stuck hint, locked-preview list, trust row
- Softer **preview check** copy (“optional quick check” — not “prove the AI wrong”)
- **Bug fix:** results “next move” card was hardcoded Solo-only → now uses `nestNextSteps` from worker
- **Discovery-first** `nestNextSteps` CTAs in worker fallbacks + prompt
- Plain-language strain/gap labels on results
- **Copy summary to share** button on results
- User-facing “Life Canvas” → **“conditions check-in”** (internal code unchanged)

**Day/night theme (earlier in same sprint)**
- Shared bundle: `css/lilbird-tokens.css`, `lilbird-theme-chrome.css`, `lilbird-theme-pages.css`, `lilbird-home.css`, `lilbird-chat.css`, `js/lilbird-theme.js`, etc.
- Phase 1 themed pages: `index.html`, `book.html`, `format.html`, `about-luke.html`, `privacy.html`, `am-i-ready-for-coaching.html`
- **Light-mode fix:** `lilbird-theme-pages.css` must load **after** each page’s inline `<style>` (moved link in HTML)
- Chat notification dot fix: `position: relative` on `#lb-chat-btn` in `lilbird-chat.css`
- **Not themed yet:** `deep-profile.html`, `nest/`, `solo/`, `intensive/`, tools, workbooks
- Rollback homepage: `index-legacy-pre-daynight.html`
- Checklist: **`DEPLOY-DAYNIGHT.md`**

### Phase 3 — not started (backlog)

- Founder video on homepage (Luke to film; agent embeds)
- **SEO journal:** 8 articles + `articles/index.html` hub — in repo; sitemap + nav wired (May 2026). Not day/night themed yet.
- Shareable **image** card for Inner Compass results (copy button exists; visual card TBD)
- Optional: shorten assessment or show teaser earlier mid-flow
- Theme rollout to Nest, Solo, deep-profile, articles/

---

## Inner Compass — single email gate (lead gen)

### User-facing flow (default)

1. User completes assessment → optional mid-flow preview check → AI read generated → stored under `nestId`.
2. **Gate screen (v7.1+):** taste (types + plain lead + 2 paragraphs + what’s in full read) → email + optional newsletter → **Get my full read**.
3. Full results in-browser; worker emails **saved link** (`?nest=…`). Copy: “saved read” / “your link” — not “sign up for Nest.”
4. Results show **Your next move** card with discovery-first CTAs (from `nestNextSteps`).
5. Optional Nest account on results sidebar only.

### Worker: `/lead-unlock`

- **URL:** `POST https://lilbird-assessment.cwwq46sn7m.workers.dev/lead-unlock`
- **Body:** `{ nestId, email }`
- **Effect:** Sets `paid: true` and `leadUnlock: true` on KV so `?nest=…` works without Stripe.

Flow: `unlockFullRead()` → `store-profile` → `lead-unlock` → `send-profile-email` (best effort).

### Paywall (opt-in only)

- Default: **no Stripe**.
- `?paywall=1` → pay-what-you-want + Stripe.
- `?testunlock=1` → QA skip to full read.

### Key routes (lilbird-assessment worker)

| Route | Role |
|-------|------|
| `POST /analyze` | Generate read |
| `POST /store-profile` | Persist profile + canvas |
| `POST /lead-unlock` | Free email unlock |
| `POST /send-profile-email` | Resend link |
| `GET /check-paid?nestId=` | Unlocked? |
| `POST /nest-preferences` | Saturday pulse opt-in |
| `GET /ping` | Version string |

---

## Deploy map (do not confuse)

| What | Source in repo | Where it goes |
|------|----------------|---------------|
| Homepage + marketing | `index.html`, `book.html`, `format.html`, … | GitHub Pages root |
| Theme CSS/JS | `css/lilbird-*.css`, `js/lilbird-*.js` | GitHub Pages `/css/`, `/js/` |
| Inner Compass page | `Deep-profile Cursor Project/deep-profile.html` | GitHub Pages → `/deep-profile.html` |
| Assessment API | `Deep-profile Cursor Project/lilbird-assessment.js` | Cloudflare Worker **`lilbird-assessment`** |
| Solo course UI | `solo/index.html`, `solo/tools/*` | GitHub Pages → `/solo/…` |
| Solo + Intensive API | `solo/worker-solo.js` | Cloudflare Worker **`worker-solo`** |
| Nest dashboard | `nest/*` | GitHub Pages → `/nest/…` |
| Site chat API | `lilbird-chat-cloudflare-worker.js` | Cloudflare Worker **`lilbird-chat`** |
| LCI Cal webhook | `workers/lci-booking-webhook.js` | Cloudflare (workers.dev URL in Cal.com) |

**Wrong path:** `solo/tools/tool-deep-profile.html` for main Inner Compass (launcher only).

**Separate prototype:** sibling folder `lilbird-daynight/` was used for `/preview/` on GitHub — **not** the live site root. Live rollout is in **`lilbird site/`** (this repo).

---

## Pricing on site (public, May 2026)

| Offer | On-site price |
|-------|----------------|
| Discovery call | Free |
| First Flight | $299 list; often **$149** with code **IMREADY** (quiz, chat, Nest) |
| Solo course | **$197** |
| Life Change Intensive | **On discovery call** (not on homepage) |
| Inner Compass | **Free with email** (no card) |

Chat worker: First Flight **IMREADY → $149** only in `lilbird-chat-cloudflare-worker.js`.

---

## North star (unchanged)

One **Nest** dashboard as long-term home for entitlements (Inner Compass, Solo, Intensive workbook, future tools). Public site on lilbird.life; workers hold secrets and AI. Prefer convergence over new disconnected surfaces.

---

## Docs to read for specific tasks

| Task | Read first |
|------|------------|
| Any deploy | `DEPLOY-LCI-CHECKLIST.md` |
| Day/night theme | `DEPLOY-DAYNIGHT.md` |
| What changed recently | `LILBIRD-UPDATE-LOG.md`, `CONTEXT-SITE-CHANGES.md` |
| Ecosystem overview | `LILBIRD-MASTER.md` |
| Inner Compass prompts/API | `Deep-profile Cursor Project/PROJECT-CONTEXT.md` |
| Nest bugs / SQL | `nest/NEST-AI-PAUSE-CHECKLIST.md` |
| Solo only | `solo/README.md`, `solo/SOLO-COURSE-ARCHITECTURE.md` |
| GTM / analytics | `ANALYTICS-GTM.md` |
| SEO journal / articles | `articles/index.html` + `articles/*.html` |

---

## SEO journal (`articles/`)

**Hub:** https://lilbird.life/articles/ (`articles/index.html` — “The lil' bird journal”)  
**Status:** Built in repo; wired to sitemap + site nav/footer (May 2026). Luke to deploy `articles/` folder + updated `sitemap.xml` + `index.html` to GitHub Pages.

| Slug | Topic |
|------|--------|
| `feeling-stuck-in-your-late-twenties.html` | Anchor / quarter-life (featured on hub) |
| `on-paper-my-life-looks-fine.html` | Hero-language identity piece |
| `career-change-at-30.html` | Career change |
| `coaching-vs-therapy.html` | Skeptic / lane clarity |
| `how-to-make-a-big-decision.html` | Practical decision-making |
| `what-is-an-identity-crisis-in-your-twenties.html` | Identity (linked from Inner Compass on home) |
| `stuck-between-two-paths.html` | Two-paths stuck |
| `how-do-you-know-youre-ready-for-life-coaching.html` | Readiness (refreshed; linked from quiz) |

Each article: ~1,600–1,900 words, Schema.org `Article`, discovery CTA primary, quiz secondary, internal cross-links. Dark inline CSS (not day/night bundle yet).

---

## Quick test plan (after any deploy)

**Homepage**
1. View source → `v1.2.0-20260528-conversion-pass`
2. Discovery CTA in hero + pricing strip + trust strip visible
3. Day mode on home → `book.html` stays light

**Inner Compass**
1. `https://lilbird.life/deep-profile.html?testunlock=1` → full read without email
2. Full path → gate shows taste + trust → email → results + “Your next move” with discovery CTA
3. Worker ping → `v7.1.0-nest-next-discovery` or newer
4. “Copy summary to share” on results

---

## Copy-paste block (minimal — Claude project custom instructions)

```
Lil Bird handoff 2026-05-28. LIVE + working per Luke.

Homepage v1.2.0-conversion-pass: discovery call primary; pricing + trust strips; pathfinder demoted. Day/night theme on Phase 1 pages. Inner Compass v7.1.0-phase2-conversion. SEO journal: 8 articles + articles/index.html (sitemap + nav wired). Worker lilbird-assessment ping v7.1.0-nest-next-discovery. Docs: CLAUDE-HANDOFF.md, LILBIRD-UPDATE-LOG.md, CONTEXT-SITE-CHANGES.md.
```
