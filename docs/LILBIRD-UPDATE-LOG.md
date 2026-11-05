# Lil Bird Update Log

Use this as the fast-moving record of what changed, what is only local, what is deployed, and what still needs verification.

Status labels:
- `built in repo`
- `deployed`
- `deployment unverified`
- `concept only`

If a change touches pricing, booking, worker logic, or public copy, log it here.

**Nest debugging:** read `nest/NEST-AI-PAUSE-CHECKLIST.md` before suggesting SQL or code.

**Solo deploy:** all HTML/tools from `solo/` only — see `solo/README.md`. Worker API from `solo/worker-solo.js` (Cloudflare, not GitHub).

**Deep Profile deploy:** `Deep-profile Cursor Project/deep-profile.html` → `/deep-profile.html` (GitHub Pages). Assessment API from `Deep-profile Cursor Project/lilbird-assessment.js` (Cloudflare Worker `lilbird-assessment`, not GitHub). See `DEPLOY-LCI-CHECKLIST.md` § Inner Compass.

**Site chat deploy:** `lilbird-chat-cloudflare-worker.js` → Cloudflare Worker `lilbird-chat` (not GitHub).

---

## 2026-11-05 (Claude)

### Inner Compass in the Nest, phone checklist, sign-in page
- **Status:** `deployed` (Pages only)
- **Inner Compass from the Nest:** saved reads opened with `?from=nest&nest=…` get `html.ic-nest` and `css/lilbird-ic-nest.css?v=20261105n1`: painted scene, torn-paper panels, one type voice, teal "Back to your Nest" pill (the lilbird.life link is hidden there). The public assessment keeps its own look.
- **Phone:** the "For your Nest" checklist now sits after each screen's content instead of on top of every screen.
- **Sign-in / create your Nest:** scene + meadow behind it (it had lost its background when Home moved the scene to the dashboard layer), torn-paper card, teal pill buttons, plans as soft slips, back link + theme switch separated on phones. Plan copy says "My Guide" to match the Nest menu.
- `css/lilbird-nest-inner.css?v=20261105i2`.

### Nest inner screens in the torn-paper style
- **Status:** `deployed` (Pages only)
- New `css/lilbird-nest-inner.css?v=20261105i1`: Learn & grow, My Journey, Life Canvas, My Guide, settings, letters, sidebar and the first-run tour on torn paper; kickers in DM Sans (no typewriter mono); teal pill primary / outlined pill secondary buttons; soft watercolor washes for Journey area tiles; chat on paper, not a grey box.
- Fixes: header day/night switch + avatar now top-right on desktop (were stuck top-left on the real page); CMYK stripe and theme wipe hidden inside the Nest.
- Checked on the signed-in test account (Intensive) in the desktop app browser before release.

### Nest Home — new layered artwork (v3) live
- **Status:** `deployed` (Pages only)
- ChatGPT layered set dropped in: `nest/assets/lilbird-kit/v3/` (scene day/night, companions day/night with lantern at night, meadow strip day/night, four card spots: mountains, book, lantern, nest). WebP derivatives; day/night pairs share one crop so they line up.
- Full-size PNG masters + manifest + prompts kept in `art-masters/nest-v3/` and excluded from the published site via `_config.yml`.
- `css/lilbird-nest-concept.css?v=20261105c2`, `nest/nest-client.js?v=73` (card spot paths). Fixture updated to match.

### Nest Home — code-drawn torn paper + one painted scene layer
- **Status:** `built in repo` (Pages only, no worker or data changes)
- New `js/lilbird-deckle.js`: injects SVG filters (`#lb-deckle-a/b/c/soft`) that tear panel edges from noise, so edges stay crisp at any card height. Replaces stretched `panels/*.webp` masks.
- New `css/lilbird-nest-concept.css?v=20261105c1`, loaded after `lilbird-nest-world.css`: paper drawn on a `::before` layer (text never distorted); painted scene on the fixed `.nest-world-decor` layer (works on iPhone); greeting on the scene with a soft glow, no box; desktop header floats over the scene; honey brush behind the active rail item; leftover panel boxes from older theme rules cleared.
- Companions switched to the crisp cutouts `nest-companions-day.webp` / `nest-companions-night.webp` (lantern). Removed the shadow filter on them (large filtered images failed to paint in Chromium).
- Art slots ready for ChatGPT layered art: swap `--scene-day/--scene-night`, the companion `src`, and fill `.nest-companions-stage::after` with the transparent meadow strip.
- `nest/index.html` + `nest/phase1b-world-fixture.html` updated together. Pre-existing test failures (4, closure copy + solo access) unchanged.

## 2026-10-01

### Security pass, 5 Voices retired, email sequence + unsubscribe
- **Status:** `built in repo` (nothing below is live until deployed)
- **Supabase:** run `nest/security-hardening-2026-10.sql`. Browsers can no longer write `user_entitlements`, `lci_sessions`, `intensive_enrolments`, or paid columns on `course_users`; `get_user_id_by_email` / `initialise_sessions` locked to service role; `initialise_lci_sessions` requires the caller's own paid Intensive.
- **worker-solo `v1.17-auth-gates`:** `/chat`, `/summarise`, `/session-email`, `/notify-illustrator` need a logged-in Solo buyer; `/nest-welcome-email` and intensive contract need login; email comes from the login, not the request body. Solo videos served via 6-hour signed links from private R2 (`/solo-video-url`, `/solo-video`). Stripe webhook rejects unknown products and unpaid sessions. Intensive enrol can't overwrite an already-paid account.
- **Assessment worker `v7.5.0-sequence-security`:** pay-what-you-want / promo / `/create-payment-intent` removed; `paid` can no longer be set from the browser; CORS limited to lilbird.life + orangery.solutions; per-IP rate limits on AI and email routes (only active when deployed with wrangler); 5 Voices removed from prompts and stored profiles.
- **Email:** 10-email story sequence (days 1–24) for Inner Compass emails, Saturday pulse now rotates through all subscribers, daily cap `DAILY_EMAIL_CAP` (default 80), one-click unsubscribe (`/unsubscribe`, List-Unsubscribe headers). Sequence will not send until `MAILING_ADDRESS` is set.
- **deep-profile.html `v7.6.0`:** pay screen, client-side promo codes (LUKE100 etc.), `?paywall=1`, `?testunlock=1` / `?testpay=1` and 5 Voices tags/glossary removed.
- **lci-booking-webhook:** Intensive bookings without a paid Intensive are rejected and logged.
- **5 Voices:** removed from chat worker, Roots & Wings workbook, Relationship Dynamic pages. Kept on `about-luke.html` certification/training lines.
- **Archived** (moved to `../lilbird-site-archive-2026-10/`): `worker-v3.js`, `assessment.legacy-backup.html`, `index-legacy-pre-daynight.html`. Delete them from the GitHub repo too.
- See `DEPLOY-SECURITY-2026-10.md` for the step-by-step.

### Later Oct 1 — repo + CLI setup, Saturday pulse retired
- **Status:** `deployed`
- Site repo now cloned at `~/Projects/lilbird-site` (GitHub `lilbirdlifecoaching/lilbirdlifecoaching.github.io`); pages are pushed from there. Workers stay in this iCloud folder and deploy with `wrangler` (assessment worker uses `Deep-profile Cursor Project/wrangler.toml`, `keep_vars = true`).
- Pushed the Sep 17 `chat.js` (Cal.com + coaching booking links). Removed `lilbird-chat-cloudflare-worker.js` and `nest/admin-grant.js` from the public site.
- Saturday pulse removed (overlaps with Beehiiv): opt-in box gone from `deep-profile.html`, weekly send + confirm email gone from the worker (`v7.5.1-no-saturday-pulse`), privacy policy wording updated.
- $27 online workbook access decided: $27 buyers + Intensive only.

### Paid tiers: free read · $2 full read + Nest · Nest Plus · $27 workbook
- **Status:** `built in repo`, not deployed (waiting on Stripe prices + Luke's OK). Worker and pages must ship together.
- **Assessment worker `v8.0.0-paid-tiers`:** the full read stays on the server. Unpaid reads return the two types, a short teaser and the list of locked sections. `/analyze` refuses to overwrite an existing read. Email is frozen once a read is paid. Paid owners get 3 retakes per purchase. Relationship Dynamic needs Nest Plus. Slider answers have their own prompt section. Emails 3, 6, 9, 10 updated.
- **worker-solo `v1.18-nest-tiers`:** `/inner-compass-checkout` ($2 plus optional +$5 Nest Plus / +$27 workbook, hosted Stripe Checkout), `/nest-upgrade-checkout` (logged in), `/workbook-content` (protected workbooks from private R2). The webhook grants `inner_compass` / `nest_plus` / `lcs_workbook`, links the read, flags it paid and sends an unlock email. Coaching purchases now grant `coaching`, which includes Nest Plus. Now deployed with `solo/wrangler.toml` (R2 + KV bindings, `keep_vars = true`). Needs `STRIPE_IC_PRICE_ID`, `STRIPE_NEST_PLUS_PRICE_ID`, `STRIPE_WORKBOOK_PRICE_ID`.
- **Supabase:** `nest/security-hardening-2026-10-part3.sql`. Linking a read no longer grants anything, and a read linked to another account can't be taken over.
- **deep-profile.html `v8.0.0`:** 31 sliders plus 3 short text boxes plus the Life Canvas replace the chat. Email shows the free read, which carries the $2 offer with tick-boxes. After checkout the page polls until unlocked. The in-page Relationship Dynamic is Nest Plus only.
- **Nest:** plan badge (Nest / Nest Plus / Intensive), Nest Plus and workbook cards with "Included with…" or locked price labels, upgrade buttons, the tour adapts to access, plus a one-time "New:" step after an unlock. Fixed a missing `catch` in the dashboard loader.
- **Workbooks:** uploaded to R2 `solo-course-videos/workbooks/`; public copies removed; links go to `/workbooks/view.html?w=first-flight|life-change`. **R2 public dev URL is still on — turn it off at deploy.**
- **Homepage:** one main CTA (Inner Compass, free, about 15 min), quiz as a text link, "Two ways forward" replaces the pricing strip, coaching removed from the homepage.
- **Removed from site:** `relationship-dynamic-orangery.html`, unused root `nest-client.js`.

## 2026-09-25

### Life Change Immersion landing + enquiry
- New `/intensive/immersion/` — 3 days / 2 nights, $12,000 (+$2k/guest, max 4), Forest/Beach/Desert, enquiry-only (no Stripe).
- Intensive page: “Two ways to take the Intensive” (session arc $4,999 vs Immersion).
- Homepage Intensive card: quiet “Also: 3-day Immersion from $12,000 →”.
- Worker: `POST /immersion-enquiry` → email Luke + confirm enquirer. Version `v1.16-immersion-enquiry`.
- **Status:** `built in repo`
- **Deploy Pages:** `intensive/immersion/*`, `intensive/index.html`, `intensive/intensive-landing.css?v=20260925a`, `index.html`, `css/lilbird-home.css?v=20260925a`, `sitemap.xml`
- **Redeploy Cloudflare:** paste `solo/worker-solo.js` to `worker-solo` (enquiry form fails until this ships)

### Homepage pricing strip — coaching + limited-time First Flight
- Removed Discovery call tile (still available elsewhere on the page).
- Order: First Flight → Intensive → Coaching ($249 · 45 min) → Solo.
- First Flight: IMREADY $149 called out as **limited time / half-price for a short time only** (usually $299).
- Pathfinder coaching line + coaching book lead updated to 45 min.
- **Deploy:** `index.html`, `coaching/book.html`

### Nest picture upload + clearer booking from Nest
- **Photo:** Nest My profile owns upload/replace (Storage `childhood-photos` → `course_users.childhood_photo_url` + `tool_outputs` mirror). Any logged-in Nest user — no Solo gate. Solo Session 1 Younger You tool points to `/nest/?tab=profile` only.
- **Booking clarity:** Non-Intensive Next steps list First Flight / à la carte coaching / Intensive enrol. Sidebar: Intensive first when unlocked; else Book with Luke (FF + coaching + Intensive); Solo cards still offer live-session links. Tour adds “Book with Luke from here” when Intensive isn’t unlocked.
- **Status:** `built in repo`
- **Deploy (GitHub Pages):** `nest/index.html`, `nest/nest-client.js?v=32`, `nest/nest-styles.css?v=27`, `nest/nest-tour.js?v=2`, `nest/nest-tour.css?v=2`, `solo/tools/tool-childhood-photo.html`, `solo/index.html`
- **No worker redeploy**

### Format discoverability + Nest lil’ bird tour
- **Format wiring:** Homepage Explore + mobile → **Our process** → `/format.html`. Intensive landing arc CTA → `» See how the process works`. Format hero/title → “Our process / How the work actually goes.” Book footer label aligned.
- **Nest tour:** First-login (or **Take a tour**) spotlight walkthrough — Next steps → Products → Intensive/Solo card (if unlocked) → Profile / Inner Compass → Younger You → Ask lil’ bird. Skip/Next/Escape; remembers `localStorage` key `lilbird-nest-tour-v1`. Force replay: `/nest/?tour=1`.
- **Status:** `built in repo`
- **Deploy (GitHub Pages):** `index.html`, `format.html`, `book.html`, `intensive/index.html`, `intensive/intensive-landing.css?v=20260924c`, `nest/index.html`, `nest/nest-client.js?v=31`, `nest/nest-tour.js?v=1`, `nest/nest-tour.css?v=1`, `nest/nest-styles.css?v=26`
- **No worker redeploy** for this pass.

### Intensive landing tighten + pay-then-Nest enrol
- **Landing:** Cut copy ~50%; dropped Solo-heavy compare; clearer CTAs with » arrows.
- **Enrol:** Agreement → pay (no Nest password first). Worker `POST /intensive-prepare-enrol` creates/finds Auth user + saves contract, then Stripe. Nest password after pay.
- **Onboard:** White-glove welcome email + `enrol-success.html` checklist (» Nest password → Nest → book session 1 → workbook).
- **Worker:** `v1.15-intensive-pay-then-nest` — **redeploy Cloudflare `worker-solo`**.
- **Deploy Pages:** `intensive/index.html`, `intensive-landing.css`, `enrol.html`, `intensive-enrol.js?v=5`, `intensive-enrol.css?v=5`, `enrol-success.html`, `book.html`.

### Life Change Intensive public landing + published price
- **Change:** New `/intensive/` product landing (Solo-style): what’s included, arc, First Flight / Solo / Intensive compare, **$4,999** CTA → enrol. No youth rate, no essay scholarship, no group waitlist in this pass.
- **Wired:** Homepage pricing + pathfinder, `book.html`, `format.html`, enrol back-link, `sitemap.xml`.
- **Status:** `built in repo`
- **Deploy:** `intensive/index.html`, `intensive/intensive-landing.css`, `intensive/enrol.html`, `index.html`, `book.html`, `format.html`, `sitemap.xml`
- **Luke — Stripe:** Intensive Price ID for **$4,999** is `price_1UJGf9GAu36WZ7DdSRYbGqkT`. Set Cloudflare Worker `worker-solo` env `STRIPE_INTENSIVE_PRICE_ID` to that value (docs updated). Checkout charges whatever that env points to.

---

## 2026-09-22

### Solo guest checkout — purchase before account
- **Change:** Logged-out visitors pay from the Solo landing (name + email → Stripe) before creating a password. Webhook creates/finds Auth user via `ensureAuthUserByEmail`, upserts `course_users`, initialises sessions, grants `solo_course`. Post-pay view emails a set-password link (Nest redirect). Logged-in purchase gate unchanged.
- **Files:** `solo/index.html` (`v1.14-guest-checkout-20260922`), `solo/worker-solo.js` (`v1.14-guest-solo-checkout`), `css/lilbird-solo-theme.css`
- **New worker route:** `POST /checkout-session-status` — returns paid/email/name for success page
- **Status:** `built in repo`
- **Deploy (required):**
  1. Paste/redeploy `solo/worker-solo.js` to Cloudflare Worker `worker-solo` — guest checkout will fail until this ships
  2. Deploy `solo/index.html` + `css/lilbird-solo-theme.css` via GitHub Pages
  3. Smoke: logged out → Buy Solo → pay → set-password email → Nest → sign in Solo → sessions unlocked
  4. Smoke: logged in unpaid → purchase gate still works

### Solo public product landing
- **Problem:** `/solo/` sent logged-out visitors straight to Sign in / Create account — no product story before buying.
- **Fix:** New `view-landing` for logged-out users — what's included, eight-session arc, $197 CTA. Shell included guest buy panel in follow-up above. Homepage Solo CTAs → “Get Solo →” (still `/solo/`).
- **Status:** `built in repo`
- **Deploy:** `solo/index.html`, `css/lilbird-solo-theme.css`, `index.html` (GitHub Pages).

---

## 2026-09-17

### Solo chat broken — retired Anthropic model
- **Symptom:** Session chat replies with “Something got in the way there…”
- **Cause:** `worker-solo.js` still called `claude-sonnet-4-20250514` (retired 2026-06-15). Anthropic returns error → worker 502 `AI unavailable`. Same class of bug previously fixed on Deep Profile assessment.
- **Fix:** All Solo worker Anthropic calls → `claude-sonnet-4-6`. Version `v1.13-sonnet-4-6`.
- **Status:** `built in repo`
- **Deploy:** paste/redeploy `solo/worker-solo.js` to Cloudflare Worker `worker-solo` (not GitHub Pages). Confirm with a Solo session send after deploy.

### Nest + Deep Profile day-theme readability
- **Status:** `built in repo`
- Nest: fixed Inner Compass snapshot blurb (was hardcoded cream text on light bg); stronger day muted/ink colors; locked cards no longer faded.
- Deep Profile: day theme uses darker gold/ink for labels and body; light hero/partner cards; less washed-out muted text.
- Follow-up (`?v=20260917n`): relational “Read the dynamic” button dark ink on pink→blue gradient; Natural wiring / Right now lanes use light sage/peach washes (no charcoal bottoms); chips stay readable on white.
- **Deploy:** `nest/index.html`, `nest/nest-styles.css`, `css/lilbird-nest-theme.css`, `Deep-profile Cursor Project/deep-profile.html` → `/deep-profile.html`, `css/lilbird-deep-profile-theme.css`.

### Nest younger-you photo · drop illustrator loop
- **Status:** `built in repo`
- Solo Younger You no longer calls `/notify-illustrator` or promises a hand-drawn conversion. Photo still saves to `course_users.childhood_photo_url` + Storage.
- Full Flight Plan prefers childhood photo (legacy `illustration_url` only if no photo).
- Nest nav avatar + My profile “Younger you” card show `childhood_photo_url`; change photo via Solo Session 1.
- **Deploy (GitHub Pages):** `solo/tools/tool-childhood-photo.html`, `solo/tools/tool-full-flight-plan.html`, `solo/index.html`, `nest/index.html`, `nest/nest-client.js`, `nest/nest-styles.css`. No worker redeploy required.

### Luke voice pass across public copy (`v1.4.0`)
- **Status:** `built in repo`
- Applied approved voice examples + pattern site-wide: cut soft AI fillers (*quiet / honest / hear yourself think / container*), fewer em dashes, more stuck / wired / see yourself again / highest good language from Luke’s own words.
- Touched: `index.html`, `about-luke.html`, `am-i-ready-for-coaching.html`, `book.html`, `format.html`, `articles/index.html`, `articles/on-paper-my-life-looks-fine.html`, Deep Profile intro, Solo purchase gate, Nest login/chat placeholder, chat worker system prompt.
- Left client testimonials as-is. Cache-bust homepage `?v=20260917k`.
- **Deploy note:** chat worker needs Cloudflare redeploy separately from GitHub Pages.

### Homepage resonate links + day cell 4 (`v1.3.9`)
- **Status:** `built in repo`
- Resonate: “I know something…” → how-do-you-know; “I'm not in crisis…” → feeling-stuck (quotes stay in place).
- Day theme only (trust + resonate): cell 4 no longer solid black — ember accent + soft peach hover. Cache-bust `?v=20260917j`.

### Homepage CMYK day hover + Luke break (`v1.3.8`)
- **Status:** `built in repo`
- Day resonate/trust: restored CMYK accents + tinted hovers (cyan / magenta / yellow / ink). Night patterns unchanged.
- Meet Luke: split second paragraph after the backpack memory. Cache-bust `?v=20260917i`.

### Homepage soft night patterns (`v1.3.7`)
- **Status:** `built in repo`
- Night resonate/trust pattern overlays dialed back so quote text stays clear. Cache-bust `?v=20260917h`.

### Homepage day hover + Read cue (`v1.3.6`)
- **Status:** `built in repo`
- Day resonate/trust: soft yellow hover only (no stripe/mesh/hatch). Patterns stay night-only.
- Resonate “Read” always visible (was near-invisible until hover). Cache-bust `?v=20260917g`.

### Homepage hero / resonate / letter polish (`v1.3.5`)
- **Status:** `built in repo`
- Tighter hero → Meet Luke gap; kids hero art fades out at the bottom into the next section.
- Resonate: swapped cells 1 ↔ 4; tasteful mono “Read” cue on hover.
- Newsletter preview: three latest Beehiiv letter posts (hardcoded; RSS/API blocked client-side) in the same card format; “More from the letter →”.
- Cache-bust `?v=20260917f`. Redeploy `index.html` + `css/lilbird-home.css`.

### Homepage ticker + night hover fix (`v1.3.4`)
- **Status:** `built in repo`
- Quote ticker: forced horizontal flex, full-bleed marquee, JS clones items for seamless loop (no static doubled list).
- Recognition/trust night hover: much stronger gold solid / stripes / mesh / hatch patterns.

### Homepage three-acts pathfinder (`v1.3.3`)
- **Status:** `built in repo`
- Dropped Act 4. Pathfinder is three acts: (1) Am I Ready + Discovery, (2) Deep Profile + Solo, (3) one-on-one. Label copy updated from “four acts” → “three acts”.

### Homepage scroll polish (`v1.3.2`)
- **Status:** `built in repo`
- Removed pathfinder “how sessions work” blurb; split Act 3 (dive in) and Act 4 (Your move).
- Recognition + trust share vivid gold hover patterns (solid / stripes / mesh / hatch); dropped recognition under-copy.
- Luke float quotes → full-width photo quote ticker (6 voices).
- Hero primary CTA → Am I Ready?; nav keeps Deep Profile.
- Cache-bust `?v=20260917c`. Redeploy `index.html`, `css/lilbird-home.css`, `js/lilbird-home.js`.

### Solo complete dashboard — tabs + ghost chat fix (`v1.12-complete-dash-css-fix`)
- **Status:** `built in repo` (upload `solo/index.html` + optionally `css/lilbird-solo-theme.css`)
- **Symptom:** From Nest → Solo with course complete: Your Plan / Takeaways / Sessions tabs appear to do nothing; empty chat stuck under the journey UI.
- **Cause:** (1) Session “mark complete” CSS `.complete-panel { display:none }` also hid the completed-course tab body which reused that class. (2) `#view-session { display:flex }` overrode `.view { display:none }`, so the session chat shell stayed visible with no `activeSession`.
- **Fix:** Scope mark-complete styles to `#complete-panel`; rename dashboard wrapper to `.complete-dash-panel`; only show session view as `#view-session.view.active`.
- **Note:** “8 of 8 / Course complete” is real Supabase `session_progress` — not a display bug.

### Homepage trust-first scroll — live fix pass (`v1.3.1`)
- **Status:** `built in repo` (redeploy needed)
- **Issue:** Live showed both day + night hero headlines together; trust grid looked like one divided panel; clip/hide CSS fought `.reveal` opacity.
- **Fix:** Single `#hero-headline` / `#hero-sub` with `data-day` / `data-night`; `lilbird-theme.js` swaps copy on theme change. Trust cells reuse recognition-grid box language + stronger accents. Contained Luke float quotes. Cache-bust `?v=20260917b` on CSS/JS.
- **Redeploy:** `index.html`, `css/lilbird-home.css`, `js/lilbird-theme.js` (hard refresh after upload).

### Homepage trust-first scroll (`v1.3.0-20260917-trust-first-scroll`)
- **Status:** `deployment unverified` → superseded by v1.3.1 for hero/trust fixes
- **Locked choices:** day default; day hero “Explore the things that make you, you.” + subline about know yourself / relationships / career; night hero “Are you ready for Sunday night to feel good again?”; nav CTA **Deep Profile**; Nest label **My nest dashboard**; Acts merge **option A** with 4-acts wording + shallow→deep pathfinder; recognition → journal article map as proposed.
- **Files:** `index.html`, `css/lilbird-home.css`, `js/lilbird-home.js`, `js/lilbird-theme.js` (day default), `js/lilbird-chat.js` (lecture language removed earlier).
- **Scroll:** Hero → Meet Luke + float quotes → trust 4-box → recognition links → pricing links → pathfinder (acts + how-sessions blurb) → testimonials → journal + letter → final CTA.
- **Deploy:** upload `index.html`, `css/lilbird-home.css`, `js/lilbird-home.js` (and theme/chat JS if not already live).

## 2026-09-02

### Operating health check — deploy verified
- **Status:** `deployed` (Luke confirmed uploads/pastes; live re-check same day)
- **Workers live:** assessment **`v7.4.0-flow-trim`**, solo **`v1.12-cors-exact-origin`**, chat responds 200
- **Pages live:** deep-profile **`v7.5.1`**, Solo **`v1.11`** (+ XSS escape + noindex), Nest noindex, assessment → deep-profile redirect, updated sitemap/robots
- **Still missing:** `tools/glow-map-thumbnail-1200x630.png` still **404** on live (optional OG asset)
- **Note:** empty `POST /analyze {}` still 500 on peakPlunge — expected bad input; not a user-path bug

### Operating health check (live vs repo)
- **Status:** `deployment unverified` for Aug hardening; site otherwise up
- **Verdict:** Public hubs, Nest/Solo shells, booking JS, chat, theme CSS, Relationship Dynamic, Glow Map all respond 200. **Not seamless:** assessment worker still **`v7.3.0-phase-bc`** (repo **`v7.4.0-flow-trim`** model fix); Solo worker still **`v1.11`** (repo **`v1.12`**); Pages still on deep-profile **`v7.5.0`** / Solo **`v1.10`** (repo hardening **`v7.5.1` / `v1.11`** undeployed). Legacy `assessment.html` + old sitemap/robots still live.
- **Also:** `tools/glow-map-thumbnail-1200x630.png` **404** live (file exists in repo). `/workbooks/` **404**. Discovery still Calendly; paid bookings Cal.com — both URLs 200.
- **Canvas:** `operating-status-2026-09-02.canvas.tsx`
- **Next for Luke:** paste assessment + solo workers; upload Aug maintenance Pages set; optional glow thumbnail + chat worker.

## 2026-08-12

## 2026-08-12

### Site maintenance audit — security / wiring / SEO
- **Status:** `built in repo`
- **Audit:** [site-maintenance-audit canvas](canvases note in Cursor) — critical open items are unauthenticated assessment profile IDOR + free unlock; live assessment worker still on **v7.3.0** while repo is **v7.4.0** (model fix).
- **Fixed in repo (deploy):**
  - Solo chat + tool-snapshot XSS escaping; `SOLO_SHELL_BUILD` → `v1.11-maintenance-hardening-20260812`
  - Solo worker CORS exact-origin (`v1.12-cors-exact-origin`) — paste `solo/worker-solo.js`
  - Deep Profile `setSection` HTML escape + stronger `generateNestId` (`v7.5.1`)
  - `sitemap.xml` — add deep-profile, booking, privacy, relationship-dynamic; remove assessment.html
  - `robots.txt` — Disallow Nest/Solo/booked/enrol shells
  - Nest + Solo `noindex, nofollow`
  - `assessment.html` → redirect stub to `/deep-profile.html` (legacy full file kept as `assessment.legacy-backup.html` — **do not upload**)
  - Chat worker prompt URL → deep-profile.html (paste if updating chat)
- **You must still paste:** `lilbird-assessment.js` (live ping still v7.3.0) + `worker-solo.js` v1.12
- **Open (needs design):** JWT on `/get-profile` / Solo email routes; rate limits; Apps Script shared secret; OG 1200×630 image

### Day/night theme — Wave 5b: Relationship Dynamic
- **Status:** `built in repo`
- **Change:** Standalone Relationship Dynamic page uses shared `lilbird-theme` + nav Day/Night toggle. New `css/lilbird-relationship-dynamic-theme.css`. `lilbird-theme-nav.js` also recognizes `.site-nav-actions`.
- **Files:** `css/lilbird-relationship-dynamic-theme.css`, `Deep-profile Cursor Project/relationship-dynamic.html`, `js/lilbird-theme-nav.js`
- **Deploy:** upload those three → `relationship-dynamic.html` live as `/relationship-dynamic.html`.

### Day/night theme — Wave 5: Deep Profile / Inner Compass
- **Status:** `built in repo`
- **Change:** Inner Compass (`deep-profile.html` `v7.5.0`) uses shared `lilbird-theme` persistence + Day/Night toggle in nav. New `css/lilbird-deep-profile-theme.css` remaps tokens and key chrome (chat, results, loading overlay) for light mode. `--dark` kept for gold button text.
- **Files:** `css/lilbird-deep-profile-theme.css`, `Deep-profile Cursor Project/deep-profile.html`
- **Deploy:** upload `css/lilbird-deep-profile-theme.css` + deploy `Deep-profile Cursor Project/deep-profile.html` → `/deep-profile.html` (plus shared `css/lilbird-tokens.css`, `css/lilbird-theme-chrome.css`, `js/lilbird-theme.js`, `js/lilbird-theme-nav.js` if not already live from earlier waves).

### Day/night theme — Wave 4: Solo + tools
- **Status:** `built in repo`
- **Change:** Solo shell (`v1.10`) uses shared theme + toggles on auth/dashboard. Public Glow Map themed. All 15 `solo/tools/tool-*.html` read `lilbird-theme` from localStorage (iframe-friendly) via shared token remap CSS.
- **Files:** `css/lilbird-solo-theme.css`, `css/lilbird-solo-tools-theme.css`, `css/lilbird-tools-theme.css`, `solo/index.html`, `tools/glow-map.html`, `solo/tools/*`, `js/lilbird-theme-nav.js`
- **Deploy:** upload those CSS/JS + Solo shell + tools folders.
- **Note:** Individual Solo tools get a light pass via CSS variables; a few heavily custom tools may need polish later.
- **Next:** Deep Profile / Inner Compass.

### Day/night theme — Wave 3: Nest
- **Status:** `built in repo`
- **Change:** Nest login + dashboard use shared `lilbird-theme` persistence. Day/Night toggles on auth (top-right) and dashboard nav. New `css/lilbird-nest-theme.css`. `lilbird-theme.js` now wires/updates all `.theme-toggle` buttons.
- **Files:** `nest/index.html`, `css/lilbird-nest-theme.css`, `js/lilbird-theme.js`, `js/lilbird-theme-nav.js`
- **Deploy:** upload those files (+ keep prior wave CSS/JS if not already live).
- **Next:** Solo + tools → Deep Profile.

### Day/night theme — Wave 2: booking flows
- **Status:** `built in repo`
- **Change:** First Flight, Coaching, and Intensive enrol/success pages share `lilbird-theme` persistence + Day/Night toggle in the top bar. New `css/lilbird-booking-theme.css`. Toggle styles moved into `css/lilbird-theme-chrome.css` (so articles/booking get styled toggles). `js/lilbird-theme-nav.js` now injects into `.top-bar` when no `<nav>`.
- **Files:** `css/lilbird-booking-theme.css`, `css/lilbird-theme-chrome.css`, `js/lilbird-theme-nav.js`, `first-flight/*`, `coaching/*`, `intensive/enrol.html`, `intensive/enrol-success.html`
- **Deploy:** upload those CSS/JS files + the three booking folders’ HTML.
- **Next waves:** Nest → Solo/tools → Deep Profile.

### Day/night theme — Wave 1: articles
- **Status:** `built in repo`
- **Change:** Journal hub + all 8 articles now use shared `lilbird-theme` persistence (early head boot, Day/Night toggle via `lilbird-theme-nav.js`, light overrides in `css/lilbird-articles-theme.css`).
- **Files:** `css/lilbird-articles-theme.css`, `articles/index.html`, `articles/*.html`
- **Deploy:** upload `css/lilbird-articles-theme.css` + entire `articles/` folder.
- **Next waves:** booking flows → Nest → Solo/tools → Deep Profile.

---

## 2026-07-23

### Site chat — leaner voice (less probe / less flowery)
- **Status:** `built in repo`
- **Change:** `lilbird-chat-cloudflare-worker.js` (v2.1) — widget prompt dials down excavation (“exactly what’s going on”), signature deep questions, and AI-coach flourish; prefer concise statement + next step; same turn soft-caps (4 tight / 6 closure) kept.
- **Deploy:** paste full file into Cloudflare Worker **`lilbird-chat`** (not GitHub). Test a few turns on lilbird.life.

---

## 2026-07-21

### Nest — book ad hoc Coaching from dashboard
- **Status:** `built in repo`
- **Change:** Products tab shows **Coaching session** card → `/coaching/book.html` ($249 pay then Cal). Prefills Nest email/name when present. No entitlement (per-session).
- **Files:** `nest/nest-client.js` (`?v=29`), `nest/index.html`, `coaching/coaching-book.js`
- **Deploy:** upload those three files.

### Nest magic-link session handoff
- **Status:** `built in repo`
- **Issue:** After Site URL → `/nest/`, magic links opened Nest on the **sign-in** screen (tokens in `#access_token=…` were ignored; Nest only handled `?code=` and had `detectSessionInUrl: false`).
- **Fix:** `nest/nest-client.js` (`?v=28`) — consume hash tokens via `setSession`, keep PKCE `?code=` exchange, surface `#error=` / expired-link messages on the login form.
- **Deploy:** upload `nest/nest-client.js` + `nest/index.html` (cache bust).
- **Needs verification:** Supabase dashboard “Send magic link” and Nest “Email me a sign-in link” both land on Nest **dashboard**.

---

## 2026-07-20

### Nest signup → internal notify (hello@lilbird.life)
- **Status:** `built in repo`
- **Worker:** `solo/worker-solo.js` → `v1.11-nest-signup-notify` · after successful `/nest-welcome-email` to the user, sends Luke an internal “New Nest account” email (same recipient as Solo sales: `SOLO_SALES_EMAIL` or `hello@lilbird.life`). Opt out with env `NEST_SIGNUP_NOTIFY=false`.
- **`nest/nest-client.js`:** passes `user_id` on welcome POST (optional for notify body).
- **Deploy:** paste worker to Cloudflare; optional GitHub upload for `nest-client.js`.
- **Needs verification:** test signup at `/nest/` — user gets “Your Nest is ready”; inbox gets internal heads-up.

### Solo course complete dashboard (A hero + C tabs)
- **Status:** `built in repo`
- **`solo/index.html`** (`v1.9-solo-complete-dashboard`): when 8/8 sessions complete — closure hero, tabs **Your plan** | **Takeaways** | **Sessions**; flight plan from `full_flight_plan` tool output; take-homes from `ai_memory` / tools; URL `?view=plan|takeaways|sessions`
- **`nest/nest-client.js`:** Solo product card + sidebar when 100% — links to plan / revisit sessions
- **Deploy:** upload `solo/index.html` + `nest/nest-client.js` (GitHub Pages)

---

## 2026-07-14

### Coaching (ad hoc) — Stripe $249 → Cal.com
- **Change:** Same pattern as First Flight: pay on `/coaching/book.html`, then book on Cal.com. **$249**/session. No Nest entitlement (per-session purchase). Webhook sends welcome + Luke notify emails only.
- **Worker:** `solo/worker-solo.js` → `v1.10-coaching-checkout` · `POST /create-coaching-checkout-session` · env **`STRIPE_COACHING_PRICE_ID=price_1TssDPGAu36WZ7DdGYCWUP5m`**
- **Cal.com:** `https://cal.com/luke-haythorpe/coaching-session` (no payment on Cal)
- **Static:** `coaching/book.html`, `booked.html`, `coaching.css`, `coaching-book.js`
- **Status:** Luke confirmed working (2026-07-14) — Stripe `$249` + Cal.com book flow live
- **Upload:** `coaching/` folder + updated `book.html`, `index.html`, `format.html`, `lb-chat-safe.js`; paste worker if not already on v1.10

### Coaching rename + Cal.com (superseded by pay flow above)
- Renamed “Monthly Coaching” → **Coaching**; links now go to pay page.

### First Flight — Stripe pay on-site, then Cal.com booking
- **Change:** Mirror Intensive enrol for First Flight: pay with Stripe embedded checkout on lilbird.life, then book the 2-hour session on Cal.com (no payment on Cal). Nest auth user created/matched by email on webhook (Path A — no password before pay). Promo **IMREADY** = $150 off → $149.
- **Worker:** `solo/worker-solo.js` → `v1.9-first-flight-checkout`
  - `POST /create-first-flight-checkout-session`
  - Webhook branch `metadata.product === 'first_flight'` → grant entitlement + welcome + Luke notify emails
- **Static:** `first-flight/book.html`, `booked.html`, `first-flight.css`, `first-flight-book.js`
- **Cal.com:** `https://cal.com/luke-haythorpe/first-flight-intro-session`
- **Stripe env:** `STRIPE_FIRST_FLIGHT_PRICE_ID=price_1TsqwuGAu36WZ7DdhQCViEPa`
- **Links:** site marketing + Nest + Deep Profile + quiz + chat point to `/first-flight/book.html?code=IMREADY`. `first-flight-booking.js` redirects instead of Calendly modal.
- **Status:** built in repo
- **Needs verification:** paste worker-solo + set env var; upload `first-flight/` + updated HTML/JS; test IMREADY → $149 → booked page → Cal.com → Nest `first_flight` entitlement + emails.

---

## 2026-06-22

### Deep Profile — retired model ID caused silent fallback results
- **Bug:** `lilbird-assessment.js` called the retired
  `claude-sonnet-4-20250514` model (retired by Anthropic 2026-06-15).
  Every /analyze call failed; deep-profile.html silently caught the
  error and rendered the static getFallbackProfile() placeholder
  ("The Bright Mirror" / "The Tuned-In Companion" / ENFJ / Enneagram 3w4)
  as if it were a real read, with no visible error to the user.
  Confirmed via results sheet: every session from 6/17 onward returned
  this identical result; last distinct real result was 6/13.
- **Fix:** Updated all `claude-sonnet-4-20250514` references to
  `claude-sonnet-4-6` in lilbird-assessment.js. Updated runAnalysis()
  catch block in deep-profile.html to surface failures visibly instead
  of silently substituting the fallback profile.
- **Files updated:** `Deep-profile Cursor Project/lilbird-assessment.js`,
  `Deep-profile Cursor Project/deep-profile.html`
- **Status:** built in repo
- **Needs verification:** redeploy `lilbird-assessment` Worker on
  Cloudflare; confirm `/analyze` returns a real, varied profile via a
  fresh end-to-end run (not ?testunlock=1); check Cloudflare Worker logs
  for "Anthropic error:" entries between 6/13 and 6/17 to pin down the
  exact cutover point and confirm no users affected before 6/17.

---

## 2026-05-28 — Phase 1 + 2 conversion pass + day/night theme

**Luke confirmed:** deployed and working on live (May 2026).

### Strategic decisions (locked)
- Primary CTA: **free discovery call**
- Faith/ministry: **texture on homepage**, fuller on `about-luke.html`
- Intensive price: **on discovery call only** (not homepage)
- Inner Compass: **email gate, no Stripe** (v7.0.9+); `?paywall=1` for PWYW tests

### Day/night theme (`v1.1.0-20260617-site-wide-theme`)
- **Change:** Shared theme bundle; live `index.html` replaced with day/night homepage; Phase 1 marketing pages cross-page persistence via `lilbird-theme` in `localStorage`.
- **Files:** `css/lilbird-tokens.css`, `lilbird-theme-chrome.css`, `lilbird-theme-pages.css`, `lilbird-home.css`, `lilbird-chat.css`, `js/lilbird-theme.js`, `lilbird-theme-nav.js`, `lilbird-home.js`, `lilbird-chat.js`, `images/hero/*`, updated Phase 1 HTML.
- **Fixes:** `lilbird-theme-pages.css` loads after inline `<style>` on marketing pages (light backgrounds); chat dot pinned to bird button only.
- **Backup:** `index-legacy-pre-daynight.html`
- **Not themed:** deep-profile, nest, solo, intensive, tools
- **Checklist:** `DEPLOY-DAYNIGHT.md`
- **Status:** **deployed** (Luke verified)

### Homepage / book / format (Phase 1 conversion)
- **Change:** Discovery call primary CTA; pricing + trust strips; testimonials reordered for ICP; pathfinder demoted; ministry as texture; jargon trimmed on home + format session blocks.
- **Build:** `index.html` → `v1.2.0-20260528-conversion-pass`
- **Files:** `index.html`, `book.html`, `format.html`, `css/lilbird-home.css`, `css/lilbird-theme-pages.css`
- **Status:** **deployed** (Luke verified)

### Inner Compass (Phase 2 conversion)
- **Change:** Richer pre-email gate (plain lead, 2 paras, locked preview list, trust row); softer preview check copy; next-steps card fixed (was hardcoded Solo only) + discovery-first CTAs; plain-language strain/gap labels; copy-summary button; “Life Canvas” → “conditions check-in” in user-facing copy.
- **Build:** `v7.1.0-20260528-phase2-conversion`
- **Worker:** `lilbird-assessment.js` → ping `v7.1.0-nest-next-discovery`
- **Deploy:** `Deep-profile Cursor Project/deep-profile.html` → `/deep-profile.html`; paste worker to Cloudflare `lilbird-assessment`
- **Status:** **deployed** (Luke verified)

### Phase 3 backlog (not started)
- Founder video embed; SEO articles; shareable result image card; theme to Nest/Solo/deep-profile

---

## 2026-05-28 — SEO journal: 8 articles + hub

- **Change:** Eight long-form ICP articles (~1,600–1,900 words each) + `articles/index.html` hub (“The lil' bird journal”). Schema.org Article markup, discovery CTA primary, quiz secondary, internal cross-links. Refreshed `how-do-you-know-youre-ready-for-life-coaching.html`.
- **Site wiring (repo):** `sitemap.xml` updated (hub + all 8 URLs); Journal link in `index.html` nav + footer; cross-links from home (on-paper article, identity article), quiz (readiness article), `book.html` / `format.html` footers.
- **Files:** `articles/*.html` (9 files), `sitemap.xml`, `index.html`, `am-i-ready-for-coaching.html`, `book.html`, `format.html`
- **Deploy:** Upload entire `articles/` folder + updated files to GitHub Pages. Articles use dark inline CSS — not day/night theme yet.
- **Status:** built in repo — deployment unverified (Luke: read anchor piece for voice before bulk publish)

---

- **Change:** Shared `lilbird-gtm-id.js` + `lilbird-gtm.js`; GTM snippets on main marketing/conversion pages. Removed direct `gtag.js` on pages that had it (GA4 now via GTM only — configure in tagmanager.google.com). See **`ANALYTICS-GTM.md`**.
- **Container:** `GTM-NG8ZFNX2` in `lilbird-gtm-id.js` + noscript iframes. **Luke:** upload JS + HTML to GitHub Pages; publish GTM with GA4 tag `G-P9C0PBTHXB`.
- **Status:** built in repo — deployment unverified

---

## 2026-05-28 — Homepage: StoryBrand order, copy pass, light SEO

### Homepage structure + voice
- **Change:** Testimonials + Meet Luke moved **above** pathfinder and Acts (proof + guide before process). Testimonial carousel leads with plain-speech clients (Goodwyn, Wanda, Ed, Todd). Copy tightened: fewer em-dash stacks, dropped repeated “brave step” / “deep runway” / coaching-slop phrases; Act 2 journey compressed to 3 steps; Act 4 offering grid replaced with pointer back to pathfinder + book CTAs.
- **SEO:** Meta description + Open Graph/Twitter + JSON-LD updated with natural “life/leadership coaching,” transition intent, Bay Area & Melbourne (matches `about-luke.html`). One human recognition-line with “life coach” (not keyword stuffing).
- **Files:** `index.html`, `format.html`, `book.html`, `about-luke.html`, `am-i-ready-for-coaching.html`, `Deep-profile Cursor Project/deep-profile.html` → deploy as `/deep-profile.html`
- **Status:** built in repo — **deploy:** upload those HTML files to GitHub Pages (deep-profile from `Deep-profile Cursor Project/`, not `solo/tools/tool-deep-profile.html`)
- **Verify:** Scroll order on home; meta/OG on format, book, about-luke, quiz, deep-profile intro

---

## 2026-05-28 — Inner Compass: single email gate (lead gen / Google Ads)

### Frictionless unlock (no double preview / no Nest signup)
- **Change:** One screen after analysis: taste (types + one paragraph) → email + optional newsletter checkbox → **Get my full read** opens full results + emails saved link. Removed blurred teaser + second unlock click. Beehiiv only if opted in. Copy: “saved read” / “your link” (not “sign up for Nest”). Optional `/nest/` account called out on results sidebar only.
- **Lead unlock:** Worker `POST /lead-unlock`; `?paywall=1` restores Stripe flow.
- **Files:** `Deep-profile Cursor Project/deep-profile.html` (`DEEP_PROFILE_BUILD` **v7.0.9-20260528-single-email-gate**), `lilbird-assessment.js` (ping **v7.0.8-lead-unlock** — deploy worker if `/lead-unlock` not live yet)
- **Status:** built in repo — deploy `deep-profile.html` (+ worker if needed)
- **Verify:** `?testunlock=1`; full path = email once → results. Mid-flow preview-read unchanged.

---

## 2026-05-30 — Solo: Glow Map compare, scroll, post-tool coach replies

### Glow Map Sessions 4 & 7 — before/after + UX
- **Change:** Session 7 (and 4) Glow Map compares to **Session 2** (`glow_map_s2`): dual radar in tool, delta bars on chat card + left panel. Post-tool coach uses structured `tool_return` (not generic “How did that land?”). Chat scroll stays on tool card when embed closes (no jump to top/bottom).
- **Files:** `solo/index.html` (`SOLO_SHELL_BUILD` `v1.7-glow-compare-20260530`), `solo/tools/tool-glow-map.html`, `solo/worker-solo.js` (`WORKER_VERSION` **`v1.7-tool-return-ack`**)
- **Status:** built in repo; **deployed** on live check (2026-05-30): solo HTML + glow tool + worker ping `v1.7-tool-return-ack`
- **Verify in browser:** Console → `lil' bird Solo shell v1.7-glow-compare-20260530`. Hard refresh if stale (GitHub Pages `max-age=600`). Before/after requires **Session 2 Glow Map saved once** (`glow_map_s2` in `tool_outputs`).
- **Docs:** `solo/README.md`, `solo/SOLO-COURSE-ARCHITECTURE.md` §7, `DEPLOY-LCI-CHECKLIST.md`

### Solo session UI (prior)
- **Change:** Session view scroll/grid fixes; session email take-home from `[ACTION:…]`; Deep Profile dashboard card unwraps `/get-profile` (`profile` key). See earlier log entries under Solo consolidation.

---

## 2026-05-30 — Deep Profile: Life Canvas history, Saturday pulse, site chat offer

### Life Canvas history modal (Nest read)
- **Change:** “See your history →” on paid read; modal tabs **The arc / Patterns / Then & now**; seeds first canvas as baseline entry; persists via worker `store-profile`.
- **Files:** `Deep-profile Cursor Project/deep-profile.html` (build `v7.0.4-20260530`)
- **Status:** built in repo; **deployed** on live `deep-profile.html` (history modal CSS/JS present on live fetch)
- **Deploy:** Re-upload `deep-profile.html` after each change; confirm HTML comment + `DEEP_PROFILE_BUILD` in console.

### Saturday pulse opt-in
- **Change:** Checkbox on read saves `saturdayReminder` + email via `/nest-preferences`; **instant confirmation email** on opt-in; weekly batch via Worker cron (`0 15 * * 6` in `wrangler.toml`).
- **Files:** `Deep-profile Cursor Project/lilbird-assessment.js` (**v7.0.7**), `deep-profile.html`, `Deep-profile Cursor Project/wrangler.toml`
- **Status:** built in repo — **worker + cron need deploy** for emails to send; frontend on live once HTML uploaded
- **Verify worker:** `GET …/lilbird-assessment…/ping` → `v7.0.7`

### Site chat — First Flight copy (IMREADY / $149)
- **Change:** Chat worker prompt uses **IMREADY** fixed **$149** (list $299); no FIRSTFLIGHT / 20% language.
- **Files:** `lilbird-chat-cloudflare-worker.js`
- **Status:** built in repo — redeploy `lilbird-chat` Worker after pull

---

## 2026-06-01 — Solo folder consolidation

- **Removed:** entire `lilbird-solo/` tree (legacy `Final index/`, duplicate tools, old worker path).
- **Moved:** `worker-solo.js` → `solo/worker-solo.js`; `SOLO-COURSE-ARCHITECTURE.md` → `solo/SOLO-COURSE-ARCHITECTURE.md`.
- **Added:** `solo/README.md` (deploy map).
- **Docs updated:** `LILBIRD-MASTER.md`, `nest/NEST-SETUP-GUIDE.md`, `DEPLOY-LCI-CHECKLIST.md`, `Deep-profile Cursor Project/PROJECT-CONTEXT.md`.
- **Needs verification:** paste `solo/worker-solo.js` to Cloudflare if not done since move; GitHub upload `solo/` only.

---

## 2026-05-28 — Intensive checkout promo codes

### Promo / coupon on Life Change Intensive enrolment
- **Problem:** Intensive Stripe sessions were created without `allow_promotion_codes`, so embedded checkout had no “Add promotion code” — unlike Solo.
- **Change:** Enrol page promo field (apply before pay); worker pre-applies valid Stripe promotion codes or enables `allow_promotion_codes`; checkout modal reminds users where to enter a code. URL `?code=` / `?promo=` prefill.
- **Files:** `intensive/enrol.html`, `intensive-enrol.js?v=4`, `intensive-enrol.css?v=3`, `book.html`, `solo/worker-solo.js` (promo logic in same worker; live version now **`v1.7-tool-return-ack`** includes Intensive promo + Solo tool-return)
- **Status:** built in repo — verify enrol page + worker on live before assuming promo UI is up
- **Deploy:** Paste latest `solo/worker-solo.js` to Cloudflare; upload intensive files to GitHub Pages. Ping should return **`v1.7-tool-return-ack`** (or newer). Stripe Dashboard: promotion codes must be **active** and valid for Intensive price `price_1TcVcLGAu36WZ7DdO4r3840Q`.

---

## 2026-05-28 — Life Change Intensive session booking (Cal.com)

### LCI session booking system
- **Change:** Cal.com-integrated session booking in Nest for LCI clients. 8 sessions tracked in `lci_sessions`. Cloudflare webhook marks sessions booked on `BOOKING_CREATED`. Nest Intensive card shows counter, progress bar, session list, and booking button.
- **Files created:** `workers/lci-booking-webhook.js`, `nest/lci-sessions.sql`, `workers/LCI-WEBHOOK-SETUP.md`
- **Files updated:** `nest/nest-client.js?v=19`, `nest/nest-styles.css`, `nest/admin-grant.js`, `worker-solo.js` (v1.5 — init sessions on Stripe purchase)
- **Cal.com URL:** https://cal.com/luke-haythorpe/life-change-session
- **Status:** built in repo
- **Needs verification:** Deploy nest v19 to GitHub Pages; Cal.com webhook → **workers.dev** URL (domain not on Cloudflare); end-to-end test. See `DEPLOY-LCI-CHECKLIST.md`.
- **Not yet built:** cancellation/reschedule sync, session completion marking, booking confirmation emails

---

## 2026-05-28 — Life Change Intensive enrolment flow

### Intensive: contract → Stripe → email → Nest
- **Change:** New enrol path at `/intensive/enrol.html` (Option B agreement page, sign, Nest account, embedded Stripe). Webhook branches on `metadata.product` for `life_change_intensive`. Welcome email + Nest checklist mirror each other (Nest, booking link, workbook).
- **Files:** `intensive/*`, `nest/intensive-enrolments.sql`, `nest/nest-client.js?v=18`, `book.html`, `solo/worker-solo.js` (v1.4-intensive-enrol)
- **Status:** built in repo
- **Luke before go-live:** Run SQL; set `STRIPE_INTENSIVE_PRICE_ID` + `INTENSIVE_BOOKING_URL` on worker; replace contract placeholder in `enrol.html`; paste Calendly 7-session link in worker env + `nest-client.js` + `INTENSIVE-SETUP.md`. See `intensive/INTENSIVE-SETUP.md`.

---

## 2026-05-28 (open items batch — Cursor)

### 1. Nest welcome email
- **Change:** Added `POST /nest-welcome-email` to `worker-solo.js` (Resend). Wired `NEST_WELCOME_EMAIL_ENDPOINT` in `nest/nest-client.js`.
- **Files:** `solo/worker-solo.js`, `nest/nest-client.js`, `nest/index.html` (`?v=11`)
- **Status:** built in repo
- **Needs verification:** Deploy **worker-solo** to Cloudflare (paste updated `worker-solo.js`). Test signup at `/nest/` — inbox receives “Your Nest is ready”. Requires `RESEND_API_KEY` already on worker.

### 2. Workbook buttons + Nest return path
- **Change:** Nest cards/sidebar link to workbooks with `?from=nest`. Workbooks show **← Nest** when opened from Nest; load auth bridge.
- **Files:** `nest/nest-client.js`, `workbooks/first-flight-standalone.html`, `workbooks/roots-and-wings-workbook.html`
- **Status:** built in repo
- **Needs verification:** Deploy `workbooks/` folder to `lilbird.life/workbooks/` if not live yet.

### 3. First Flight pricing alignment (IMREADY = $149)
- **Change:** Fixed remaining “25% off” / `$299` quiz CTA copy.
- **Files:** `am-i-ready-for-coaching.html`, `tools/glow-map.html`, `worker-v3.js` (Deep Profile + assessment worker email paths were already $149 in repo)
- **Status:** built in repo
- **Needs verification:** deploy static files; optional: redeploy assessment worker if `worker-v3.js` is still used anywhere live

### 4. Solo auth bridge
- **Change:** `<script src="/lilbird-auth-bridge.js">` before Supabase in Solo shell.
- **Files:** `solo/index.html` (was briefly edited in legacy `lilbird-solo/…/Final index/` — removed)
- **Status:** built in repo
- **Needs verification:** upload to live `/solo/` on GitHub

### 5. Stripe auto-grant `solo_course` entitlement
- **Change:** On `checkout.session.completed`, worker upserts `user_entitlements` (`solo_course`, `granted_by: stripe`) using service role.
- **Files:** `solo/worker-solo.js` (same deploy as #1)
- **Status:** built in repo
- **Needs verification:** test purchase; confirm row in Supabase; Nest shows Solo unlocked without manual grant

---

## 2026-05-28

### Documentation — Nest ops + lessons learned
- **Change:** Added `nest/NEST-AI-PAUSE-CHECKLIST.md` (verification + anti-loop prompts). Rewrote `nest/NEST-SETUP-GUIDE.md` for v10. Updated `LILBIRD-MASTER.md`, `CONTEXT-SITE-CHANGES.md`, `nest/INVESTIGATION-SESSION-MISMATCH.md` (resolved), Deep Profile `PROJECT-CONTEXT.md` Nest notes.
- **Status:** built in repo
- **Purpose:** Luke + AI pause on correct Supabase project, live version, session UID vs entitlements before repeating fixes.

### Nest Dashboard — v10 UX, shared auth, deploy fixes
- **Change:**
  - Inner Compass card distinguishes **unlocked** (`inner_compass` entitlement) vs **complete** (profile via `deep_profile_links` + worker `/get-profile`)
  - Deep Profile: **← back to your Nest** when `?from=nest`; loads `lilbird-auth-bridge.js`
  - Nest uses `lilbird-solo-auth` (same as Solo); root `lilbird-auth-bridge.js` migrates legacy `lilbird-nest-auth`
  - Login button: `finally` reset, `loginInFlight` guard (fixes stuck “Logging in…”)
- **Files:** `nest/nest-client.js`, `nest/nest-styles.css`, `nest/index.html` (`?v=10`), `lilbird-auth-bridge.js`, `Deep-profile Cursor Project/deep-profile.html`
- **Status:** deployed (Luke confirmed GitHub upload 2026-05-28)
- **Needs verification:** live View Source shows `nest-client.js?v=10`; cross-page session; IC badges after GitHub Pages refresh

### Nest — setup mistakes documented (not code)
- Wrong Supabase project (separate “Nest” DB) — table had to live in Solo `mebqqzbuwkogdxvnihrq`
- Session UID `b987...` vs real user `4ac...` — entitlements on correct id but browser on stale session
- Nest `index.html` uploaded to **site root** — homepage briefly showed Nest login; restored root marketing `index.html`
- Live site lagged local (`v7` vs `v10`) — always check production `?v=` not iCloud folder alone
- **Reference:** `nest/INVESTIGATION-SESSION-MISMATCH.md`, `nest/NEST-AI-PAUSE-CHECKLIST.md`

## 2026-05-27

### Nest Dashboard - initial build
- **Change:** Built /nest/ dashboard with Supabase auth,
  user_entitlements table integration, product cards (locked/unlocked),
  next steps banner, three-tab nav, sidebar cards, chat widget
  hint, and welcome-email hook point for Resend.
- **Files created:** `nest/index.html`, `nest/nest-client.js`,
  `nest/nest-styles.css`, `nest/admin-grant.js`,
  `nest/user_entitlements.sql`
- **Supabase:** SQL for `user_entitlements` + RLS added at
  `nest/user_entitlements.sql` (ready to run)
- **Status:** built in repo
- **Needs verification:** visual check all three product states,
  test admin-grant.js, test welcome email, confirm Solo Course
  unaffected
- **Not yet built:** coach portal, Stripe automation,
  auth unification

## 2026-05-27

### Nest Dashboard - architecture decisions locked
- **Decisions made:**
  - Universal login: every product purchase triggers a Nest
    account (Inner Compass, Solo Course, First Flight,
    Life Change Intensive)
  - Entitlement model confirmed: user_entitlements table
    in existing Supabase project
  - Manual entitlement grant via admin script for now
  - Automated Stripe grant deferred
  - Solo Course auth and tables remain untouched
  - Coach portal deferred — likely coachesandguides.com
    not lilbird.life
  - Next steps banner on all dashboard states
  - Three tabs: My products, My profile, Ask lil' bird
  - Life Change Intensive booking is self-serve via
    Calendly (lilbird.life/book), no approval gate needed
  - lil' bird chat widget available inside dashboard
    via Ask lil' bird tab
  - Relationship Dynamic confirmed live at
    lilbird.life/relationship-dynamic.html
  - Workbooks confirmed at workbooks/ folder, not deployed
- **Status:** concept only → ready to build
- **Next step:** build /nest/ per Claude brief dated 2026-05-27

## 2026-05-27

### First Flight pricing language - consistency fix
- **Change:** Updated IMREADY promo language in Deep Profile
  surfaces from "25% off" to fixed "$149" to match
  first-flight-booking.js and am-i-ready-for-coaching.html
- **Files updated:** `Deep-profile Cursor Project/deep-profile.html`,
  `Deep-profile Cursor Project/lilbird-assessment.js`
- **Status:** built in repo
- **Needs verification:** visual check on Deep Profile result
  page after next deploy

## 2026-05-26

### Solo Course - pricing confirmed and docs updated
- **Change:** Base price updated from $97 to $197.
  SOLO50 promo code applies 50% off, bringing price to $98.50.
- **Confirmed via:** live Stripe payment received + `solo/index.html`
  reviewed (BASE_PRICE = 197, SOLO50 discount = 0.5)
- **Files updated:** `SOLO-COURSE-ARCHITECTURE.md`
- **Files already correct:** `solo/index.html`
- **Status:** deployed

### Solo Course - purchase notification email
- **Change:** Stripe webhook now sends an internal email to `hello@lilbird.life` when a Solo Course purchase completes.
- **Files updated:** `solo/worker-solo.js`
- **Delivery method:** Resend from the confirmed `checkout.session.completed` webhook path
- **Included in email:** buyer name/email when available, amount paid, discount amount when present, purchase time, Stripe session id, Stripe customer id, and user id
- **Status:** deployed
- **Needs verification:** complete one real or test purchase to confirm the email arrives at `hello@lilbird.life`

## 2026-05-25

### Cross-project

- **Decision:** Lil Bird should simplify toward one central dashboard or "nest" experience instead of growing as disconnected products.
- **Status:** concept only
- **Notes:** eventual dashboard should contain Inner Compass, Solo course, and buyer-only materials such as the Life Change Intensive workbook layer.

### Documentation

- **Change:** added `LILBIRD-MASTER.md` and `LILBIRD-UPDATE-LOG.md` as shared docs for GPT + Claude + human tracking.
- **Status:** built in repo
- **Needs verification:** both assistants should use these files consistently going forward.

### Dashboard architecture

- **Change:** added a new dashboard architecture section to `LILBIRD-MASTER.md` defining the Nest as the proposed central home for Lil Bird users.
- **Includes:** user types, entitlement logic, product access map, data ownership model, workbook access flow, coach lead sheet concept, scaling model, and first build priorities.
- **Status:** concept only
- **Needs verification:** Luke + Claude should confirm the auth model, entitlement flow, and what remains local-only versus stored in Supabase.

### Workbooks - Life Change Intensive + First Flight standalone

- **Change:** Claude proposed two workbook surfaces:
  - `workbooks/roots-and-wings-workbook.html`
  - `workbooks/first-flight-standalone.html`
- **Status:** concept only
- **Current repo reality:** both files now exist locally in the repo under `workbooks/`, but are not considered ready for deployment.
- **Next step:** keep them local until the Nest/dashboard access model is clearer and they are wired into the right entitlement flow.

### Main site / First Flight booking flow

- **Change:** shared modal gate exists in `first-flight-booking.js` to intercept First Flight Calendly links and show the code before checkout.
- **Files:** `first-flight-booking.js`, `index.html`, `about-luke.html`, `book.html`, `format.html`, `assessment.html`, `am-i-ready-for-coaching.html`
- **Current repo pricing:** list `$299`, offer `$149`, code `IMREADY`
- **Status:** built in repo
- **Needs verification:** live site behavior should be checked in production after deploy on every page that links to First Flight.

### Main site / Meet Luke

- **Change:** homepage Meet Luke section currently keeps `lil-luke.png` on the left and adds `luke-head-edit.png` above the text on the right. `about-luke.html` also includes `luke-head-edit.png`, left-aligned above the body copy.
- **Files:** `index.html`, `about-luke.html`
- **Status:** built in repo
- **Needs verification:** visual check on desktop and mobile after deploy.

### Main site / Am I Ready quiz

- **Change:** quiz pricing logic now references a fixed First Flight quiz offer of `$149` with code `IMREADY`, plus lower-commitment options at the bottom of the result CTA area.
- **Files:** `am-i-ready-for-coaching.html`
- **Status:** built in repo
- **Known ambiguity:** chat history suggested the extra discount highlight card might be removed, but current repo state still contains `quiz-offer-highlight`.
- **Needs verification:** confirm intended final UX before next deploy if this page is edited again.

### Pricing / Calendly

- **Change:** founder confirmed `IMREADY` coupon has been updated in Calendly to support the `$149` offer.
- **Status:** deployment unverified
- **Needs verification:** none from repo alone, but a real checkout pass is still the best safety check after any related edits.

---

## 2026-05-22

### Glow Map pilot

- **Change:** public Glow Map pilot built as a standalone lead-gen experience with intro, tool, insight read, CTA paths, and per-axis question/action guidance for the lowest score.
- **Files:** `tools/glow-map.html`, `tools/DEPLOY-GLOW-MAP.md`, `sitemap.xml`, `CONTEXT-SITE-CHANGES.md`
- **Status:** built in repo
- **Deployment status:** unknown from local files alone
- **Notes:** image asset also exists for sharing: `tools/glow-map-thumbnail-1200x630.png`

---

## 2026-05-12

### Deep Profile vocabulary pass

- **Change:** Deep Profile context doc records v7.0.1 archetype family vocabulary shift to Trailblazer / Dreamer / Anchor / Spark / Haven.
- **Files:** `Deep-profile Cursor Project/PROJECT-CONTEXT.md`
- **Status:** built in repo
- **Deployment status:** see Deep Profile verification flow in the project context doc

---

## 2026-05-11

### Main site hardening

- **Change:** security, abuse resistance, and performance pass on chat + main site.
- **Files:** `lb-chat-safe.js`, `index.html`, `chat.js`, `lilbird-chat-cloudflare-worker.js`, `_headers`, `sitemap.xml`, testimonial image assets
- **Status:** built in repo
- **Deployment notes:** worker and static deploy both required; see `CONTEXT-SITE-CHANGES.md`

---

## 2026-05-10

### Main site narrative / pathfinder / naming

- **Change:** homepage and offer architecture clarified around First Flight, Solo, Intensive, discovery, and About Luke.
- **Files:** `index.html`, `about-luke.html`, `book.html`, `format.html`, `CONTEXT-SITE-CHANGES.md`
- **Status:** built in repo

### Calendly slug cleanup

- **Change:** booking URLs normalized to `https://calendly.com/lilbirdlifecoaching/...`
- **Files:** `index.html`, `book.html`, `format.html`, `about-luke.html`, `assessment.html`, `am-i-ready-for-coaching.html`, `chat.js`
- **Status:** built in repo

---

## Undated But Important

### Relationship Dynamic embed

- **Change:** standalone embeddable `relationship-dynamic.html` exists for use outside the Nest flow.
- **Files:** `Deep-profile Cursor Project/relationship-dynamic.html`
- **Status:** built in repo
- **Deployment status:** unverified

### Bridge app + backend

- **Change:** The Bridge has a product doc, Expo scaffold, and `/bridge/*` worker routes in the main Deep Profile worker.
- **Files:** `BRIDGE-ARCHITECTURE.md`, `bridge-app/`, `Deep-profile Cursor Project/lilbird-assessment.js`, `Deep-profile Cursor Project/bridge-handlers.js`
- **Status:** built in repo for v0.1 foundation
- **Deployment status:** app distribution unverified; worker deployment status unverified

### Solo course

- **Change:** Solo course architecture is strongly documented and many tool files exist, but the unified dashboard/product shell remains a bigger future build.
- **Files:** `solo/SOLO-COURSE-ARCHITECTURE.md`, `solo/tools/`
- **Status:** mixed; architecture well defined, implementation still partial

---

## Open Tracking Items

- Deploy **worker-solo v1.3** to Cloudflare (welcome email + Stripe entitlement grant).
- Deploy Nest **v11**, workbooks, Solo shell, pricing files to GitHub Pages.
- Verify Nest v11 on live after deploy (`NEST-AI-PAUSE-CHECKLIST.md`).

- Align First Flight pricing language across:
  - `first-flight-booking.js`
  - `am-i-ready-for-coaching.html`
  - `Deep-profile Cursor Project/deep-profile.html`
  - `Deep-profile Cursor Project/lilbird-assessment.js`

- Decide whether `quiz-offer-highlight` stays in `am-i-ready-for-coaching.html`.

- Refine the dashboard architecture now that the first version is documented in `LILBIRD-MASTER.md`.

- Decide whether workbook experiences should live:
  - inside the Nest
  - as standalone HTML surfaces
  - or both, with entitlements controlling access

- Keep `CONTEXT-SITE-CHANGES.md` synced with newer main-site work that currently lives mostly in chat history.

---

Last updated: 2026-05-28
