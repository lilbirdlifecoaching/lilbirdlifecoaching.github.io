# Lil Bird Master Context

This is the shared source of truth for Lil Bird across GPT, Claude, and humans.

Use this file to stay aligned on:
- the whole Lil Bird ecosystem
- current strategic direction
- what is built vs live vs still conceptual
- which deeper docs must also be updated

If architecture changes, update this file first.

**Agent handoff (Claude / GPT):** start with **`docs/CLAUDE-HANDOFF.md`** for current builds, deploy rules, conversion pass decisions, and Inner Compass lead-gen. In the GitHub repo, keep Master, Handoff, and Update Log under `docs/` so cloud agents can read them (iCloud is not reachable from scheduled runs).

**Live homepage (May 2026):** `v1.2.0-20260528-conversion-pass` — discovery call primary; day/night theme on Phase 1 pages. Inner Compass: `v7.1.0-20260528-phase2-conversion`.

---

## Current North Star

Lil Bird is being simplified so it can scale sustainably.

The current founder direction is:

1. Stop treating each offer as a separate island.
2. Move toward one central user home base or dashboard.
3. Make that dashboard the "nest" that can eventually contain:
   - Inner Compass / Deep Profile
   - Solo course
   - online workbook / material for Life Change Intensive buyers
   - future tools and follow-on products
4. Use the current products to learn and iterate, rather than overbuilding new surfaces too early.

This means future architecture decisions should favor convergence, shared identity, and one clear entry point over spinning up disconnected experiences.

---

## Ecosystem Snapshot

### 1. Main lilbird.life site

Purpose:
- public-facing brand site
- story, offers, booking, chat, lead-gen tools

Key files:
- `index.html`
- `about-luke.html`
- `book.html`
- `format.html`
- `assessment.html`
- `am-i-ready-for-coaching.html`
- `chat.js`
- `lb-chat-safe.js`
- `first-flight-booking.js`
- `lilbird-chat-cloudflare-worker.js`
- `CONTEXT-SITE-CHANGES.md`

### 2. Inner Compass / Deep Profile

Purpose:
- flagship AI-powered assessment
- produces a Nest profile
- feeds the wider Lil Bird ecosystem

Key files:
- `Deep-profile Cursor Project/deep-profile.html`
- `Deep-profile Cursor Project/lilbird-assessment.js`
- `Deep-profile Cursor Project/wrangler.toml`
- `Deep-profile Cursor Project/PROJECT-CONTEXT.md`

### 3. Relationship Dynamic embed

Purpose:
- standalone version of the "how do I work with this person?" tool
- intended for use outside the main Nest result flow
- Deployment status confirmed live at lilbird.life/relationship-dynamic.html as of 2026-05-27.

Key file:
- `Deep-profile Cursor Project/relationship-dynamic.html`

### 4. Solo course

Purpose:
- self-guided paid journey with multiple tools and an eventual course dashboard

**Live surface:** `https://lilbird.life/solo/` — deploy **only** from `solo/` (not `solo/tools/tool-deep-profile.html` alone; that file is a Session 3 launcher into Inner Compass).

Key files:
- `solo/index.html` — session shell, chat, embedded tools, tool snapshots (`SOLO_SHELL_BUILD` in console)
- `solo/tools/*` — per-session interactive tools
- `solo/worker-solo.js` — Cloudflare Worker (`WORKER_VERSION`, currently **`v1.7-tool-return-ack`**)
- `solo/README.md` — deploy map
- `solo/SOLO-COURSE-ARCHITECTURE.md` — product + technical spec

**Glow Map (S2, S4, S7):** scores stored per session (`glow_map_s2`, `glow_map_s4`, `glow_map_s7`). Sessions 4 & 7 compare visually to **Session 2** when `glow_map_s2` exists.

Important reality:
- the architecture is well defined
- the shipped shell is live; verify with hard refresh + console build string after each upload

### 5. The Bridge

Purpose:
- private couples app built on Inner Compass wiring
- check-in, translate, then generate a shared Bridge read

Key files:
- `BRIDGE-ARCHITECTURE.md`
- `bridge-app/README.md`
- `bridge-app/`
- `Deep-profile Cursor Project/lilbird-assessment.js` (`/bridge/*` routes)
- `Deep-profile Cursor Project/bridge-handlers.js`

### 6. The Nest (client dashboard)

Purpose:
- unified logged-in home at `https://lilbird.life/nest/`
- shows product access from `user_entitlements`
- links to Inner Compass, Solo, workbooks (as granted)

Key files:
- `nest/index.html`, `nest/nest-client.js`, `nest/nest-styles.css`
- `lilbird-auth-bridge.js` (site root — shared Supabase session)
- `nest/user_entitlements.sql`, `nest/CREATE-IN-THIS-PROJECT-ONLY.sql`
- `nest/NEST-SETUP-GUIDE.md`, `nest/NEST-AI-PAUSE-CHECKLIST.md`

**Auth (locked):** Same Supabase project as Solo (`mebqqzbuwkogdxvnihrq`). Browser storage key `lilbird-solo-auth`. Legacy `lilbird-nest-auth` migrated by bridge script.

**Inner Compass in Nest:** `inner_compass` entitlement = unlocked; completion = `deep_profile_links` + assessment worker profile (badges: `ready to begin` vs `complete`).

**Deploy:** GitHub Pages — Nest files only under `/nest/`; never replace root `index.html` with Nest login.

**Ops:** Before any Nest debug session, read `nest/NEST-AI-PAUSE-CHECKLIST.md`.

Status (2026-05-28): **deployed** v10 (Luke confirmed upload); verify live `?v=10` after GitHub refresh.

### 7. Public tool pilots

Current known pilot:
- Glow Map

Key files:
- `tools/glow-map.html`
- `tools/DEPLOY-GLOW-MAP.md`

---

## Dashboard Architecture

This section defines the proposed single-home-base model for Lil Bird.

Status:
- **v10 live** at `/nest/` (2026-05-28)
- architecture locked; entitlements + auth model implemented
- coach portal, Stripe auto-grant, welcome email still open

Use this section to evaluate future product decisions.

### The Nest as central home

The Nest is the unified dashboard for every Lil Bird user.

It should become the one place a user lands after any purchase or assessment.
It should surface whatever they have access to, nothing more and nothing less.
It should grow with them as they engage more deeply with Lil Bird.

This is the architectural expression of the simplification strategy.

### User types

#### 1. Client (Self-Guided)

- purchases the Solo course independently
- has a Supabase auth account
- Nest should eventually show:
  - Inner Compass result, if taken
  - Solo course progress
  - session tools
  - Full Flight Plan
- likely stored data:
  - session responses
  - tool outputs
  - AI memory
  - progress state
- no coach relationship

#### 2. Client (Life Change Intensive)

- books the Life Change Intensive
- should have a Supabase auth account or equivalent email-link access
- Nest should eventually show:
  - Inner Compass result, if taken
  - Roots & Wings workbook
  - First Flight standalone, if purchased separately
- proposed workbook privacy model:
  - workbook content stored in browser local storage only
  - Lil Bird does not store workbook content server-side
- coach relationship:
  - linked to an assigned coach when relevant

#### 3. Client (First Flight Standalone)

- books First Flight as a standalone session
- may or may not have a full Supabase account
- access model still to be decided:
  - lightweight Nest login, or
  - email link to a standalone workbook
- proposed workbook content model:
  - browser local storage only

#### 4. Coach

- separate coach login, not the same as client auth
- coach-facing home should eventually show:
  - active clients
  - lead sheet per client
- proposed privacy model:
  - coach lead sheet content stored locally on the coach's machine
  - exported to PDF for backup if needed
  - coach cannot see client workbook content
  - Luke/admin grants access manually
- Coach portal deferred. Likely to live under coachesandguides.com rather than lilbird.life. Not part of current Nest build.

### Entitlement logic

What a user sees in the Nest should be determined by what they have purchased or been granted.

Proposed foundation:
- a `user_entitlements` table in Supabase

Suggested shape:

```text
user_id      uuid   -> auth user
product      text   (inner_compass | solo_course | first_flight | life_change_intensive)
granted_at   timestamptz
granted_by   text   (stripe | manual | assessment_completion)
active       bool
```

On Nest login, the dashboard would query entitlements and render only the product cards the user should see.

### Product access map

| Product | How access is granted | What appears in Nest |
|---|---|---|
| Inner Compass / Deep Profile | Assessment purchase | Profile result, archetype, Nest profile |
| Solo Course | Stripe purchase | Session cards, tools, Full Flight Plan |
| First Flight Standalone | Calendly booking + manual grant or Stripe | First Flight workbook card |
| Life Change Intensive | Calendly booking + manual grant | Roots & Wings workbook card |
| Coach access | Manual grant by admin | Client list + lead sheet per client |

### Data ownership model

This is not only a technical decision. It is a product value.

| Data type | Proposed storage | Who can see it |
|---|---|---|
| Auth + entitlements | Supabase | Lil Bird admin only |
| Solo course responses + tool outputs | Supabase with RLS | User only |
| Inner Compass result | Cloudflare KV | User only |
| Roots & Wings workbook content | Browser local storage | User only |
| First Flight workbook content | Browser local storage | User only |
| Coach lead sheet content | Coach local machine | Coach only |

If this model is kept, Lil Bird should state that workbook content is never stored server-side.

### Workbook access flow

#### Life Change Intensive client

1. Books intensive via Calendly.
2. Luke manually grants `life_change_intensive` entitlement, or later automates it.
3. Client receives an email that their Nest is ready.
4. Client logs into the Nest and sees the Roots & Wings workbook card.
5. Client opens workbook, fills it in locally, and can export PDF.
6. Lil Bird does not receive workbook content.

#### First Flight standalone client

1. Books First Flight via Calendly.
2. Luke manually grants `first_flight` entitlement, or later automates it.
3. Client receives a Nest link or direct workbook link.
4. Client opens the workbook, fills it locally, and can export PDF.
5. Lil Bird does not receive workbook content.

### Coach lead sheet

Planned, not yet built.

Principles:
- separate coach portal or coach access surface
- lead sheet per client
- lead sheet saves locally on coach machine
- PDF export per client
- no client workbook data is exposed through this layer

Luke still needs to define the content and operational model more concretely before this is built.

### Scaling model

This architecture is meant to scale by adding new entitlement types rather than spinning up disconnected products.

If the local-storage workbook model holds, then:
- workbook storage cost stays near zero on the server side
- entitlements remain small and simple
- new products can be introduced as new access types inside one Nest

### What still needs to be built

| Item | Priority | Notes |
|---|---|---|
| `user_entitlements` Supabase table | Done | Solo project `mebqqzbuwkogdxvnihrq` |
| Manual entitlement grant | Done | Supabase UI or `nest/admin-grant.js` |
| Nest dashboard shell | Done (v10) | auth, cards, tabs, shared session, IC state |
| Auth bridge on all ecosystem pages | Medium | Solo + workbooks when they get login |
| Coach portal login | Medium | separate from client auth |
| Coach lead sheet HTML tool | Medium | content not defined yet |
| Email trigger on entitlement grant | Medium | "Your Nest is ready" |
| Automated entitlement via Stripe | Low | manual grant is acceptable for now |

### Decision principle

Every future Lil Bird product should ask:

> Does this live inside the Nest, or does it need its own home, and if so, why?

Default answer:
- it lives in the Nest

An exception needs a strong reason.

---

## Core Architecture

### Main site

- Static HTML/CSS/JS site
- Booking through Calendly
- Chat experience on the site with separate Cloudflare worker

### Inner Compass / Deep Profile

- Frontend: `Deep-profile Cursor Project/deep-profile.html` → **`/deep-profile.html`** (GitHub Pages)
- Backend: `Deep-profile Cursor Project/lilbird-assessment.js` → Cloudflare Worker **`lilbird-assessment`** (paste full file; not GitHub)
- Storage: Cloudflare KV (`NEST_PROFILES`)
- Features (2026-05-30): Life Canvas history modal; Saturday pulse opt-in (`/nest-preferences` + confirmation email **v7.0.7**); cron `0 15 * * 6` in `wrangler.toml`
- **Not** the Solo tool: `solo/tools/tool-deep-profile.html` only links into the assessment

### Bridge

- Mobile app scaffold in Expo / Expo Router
- Reuses the existing `lilbird-assessment` worker
- Stores Bridge state alongside Nest data using `bridge:*` keys

### Solo course

- Designed around static frontend + Supabase + Cloudflare worker
- Architecture is documented more fully than the current shipped implementation

---

## Deployment Surfaces

Be precise about deployment status. Use:
- `built in repo`
- `deployed`
- `deployment unverified`
- `concept only`

Do not assume "deployed" unless it was explicitly verified.

### A. Main static site

Likely surface:
- `lilbird.life`

Includes:
- homepage and offer pages
- public tools
- About Luke
- Am I Ready quiz

### B. Chat worker

Source of truth:
- `lilbird-chat-cloudflare-worker.js`

### C. Deep Profile worker

Source of truth:
- `Deep-profile Cursor Project/lilbird-assessment.js`

Also powers:
- Nest persistence
- partner dynamic
- Bridge API routes

### D. Bridge app

Repo scaffold exists, but app-store level deployment is not the current reality.

### E. Nest dashboard

Surface:
- `https://lilbird.life/nest/`

Source:
- `nest/` folder + root `lilbird-auth-bridge.js`

Supabase:
- Same project as Solo (`mebqqzbuwkogdxvnihrq`)

### F. Solo course

Surface: `https://lilbird.life/solo/`

Source: `solo/index.html`, `solo/tools/*`

Worker: `solo/worker-solo.js` → Cloudflare **worker-solo** (ping `v1.7-tool-return-ack` or newer)

See: `solo/README.md`, `DEPLOY-LCI-CHECKLIST.md`

---

## Current State By Workstream

### Main site

Documented recent work already captured in `CONTEXT-SITE-CHANGES.md`:
- narrative/pathfinder/naming refresh
- Calendly slug normalization
- security/performance hardening
- Glow Map pilot

Additional current repo state not yet fully captured in that changelog:
- shared First Flight booking gate script in `first-flight-booking.js`
- Meet Luke + About Luke headshot updates using `luke-head-edit.png`
- Am I Ready quiz pricing/offer changes

### Deep Profile

Strongest existing context doc in the repo:
- `Deep-profile Cursor Project/PROJECT-CONTEXT.md`

Notable current state:
- v7.x era architecture and roadmap are documented
- Bridge endpoints now exist in `lilbird-assessment.js`
- some Deep Profile surfaces still reference `IMREADY` as a 25% offer

### Relationship Dynamic

- standalone embed page exists in repo
- intended for use on external sites like Orangery
- deployment status should be treated as unverified unless manually confirmed

### Solo course

- architecture doc is thorough
- many tool files exist
- still better described as a structured plan plus tool set than a fully unified dashboard product

### Bridge

- product concept and v0.1 architecture are documented
- Expo app scaffold exists
- backend routes exist in the main assessment worker
- this is not the central simplification path right now, but it remains a meaningful future product

---

## Important Strategic Decision

The most important current product decision is not a new tool.

It is consolidation:

- one Lil Bird user home
- one clearer system
- one place to grow from

Future work should be evaluated against this question:

> Does this move Lil Bird closer to one coherent nest, or does it create another disconnected branch?

If disconnected, it needs a strong reason.

---

## Known Inconsistencies To Resolve

These are important because they can create confusion between chat history, repo state, and live site behavior.

### First Flight pricing and language

Current repo state shows multiple versions of the First Flight offer:

- `first-flight-booking.js` uses:
  - list price `$299`
  - sale price `$149`
  - code `IMREADY`
- `am-i-ready-for-coaching.html` also uses the `$149` quiz offer
- Pay/snapshot surfaces on Deep Profile use **IMREADY → $149** (list $299) aligned with `first-flight-booking.js`
- Legacy promo codes (e.g. `EARLYBIRD` 25%) may still exist in unlock logic — treat as separate from public First Flight offer
- Site chat worker (`lilbird-chat-cloudflare-worker.js`) should match IMREADY / $149 (redeploy after repo pull)

Treat any remaining “% off” in email templates as an active copy audit item.

### Am I Ready quiz state

Conversation history suggested the extra discount highlight card might be removed.
Current repo state still contains `quiz-offer-highlight` in `am-i-ready-for-coaching.html`.

Treat current code as truth until changed, but note that founder intent may have shifted.

### Deployment truth

This workspace (iCloud) is **not** the git remote. Deploy = manual upload to GitHub → Pages.

Always verify **live** HTML (`nest-client.js?v=`) — local repo can be ahead of production.

### Nest setup mistakes (documented — avoid repeating)

| Trap | Correct approach |
|------|------------------|
| Separate "Nest" Supabase project | Use Solo project `mebqqzbuwkogdxvnihrq` only |
| Grant entitlements before matching session UID | Copy UID from Authentication → Users |
| Upload Nest `index.html` to site root | Nest lives at `/nest/` only |
| Treat entitlement as assessment complete | Check profile / `deep_profile_links` |
| Debug without live version check | `NEST-AI-PAUSE-CHECKLIST.md` first |

Full checklist: `nest/NEST-AI-PAUSE-CHECKLIST.md`. Postmortem: `nest/INVESTIGATION-SESSION-MISMATCH.md`.

---

## Canonical Docs To Keep Updated

### Always update this file when:

- product architecture changes
- priorities change
- a new workstream becomes important
- the founder makes a simplification or positioning decision

### Update these docs when relevant:

- `CONTEXT-SITE-CHANGES.md`
  - main site changes
  - copy, UX, booking flow, homepage, public tools

- `Deep-profile Cursor Project/PROJECT-CONTEXT.md`
  - Inner Compass / Deep Profile architecture, roadmap, deploy notes

- `solo/SOLO-COURSE-ARCHITECTURE.md`
  - Solo course product and technical architecture

- `solo/README.md`
  - Solo + worker-solo deploy paths and version checks

- `DEPLOY-LCI-CHECKLIST.md`
  - Nest, Intensive, Inner Compass, Solo upload matrix

- `BRIDGE-ARCHITECTURE.md`
  - Bridge product direction and backend model

- `tools/DEPLOY-GLOW-MAP.md`
  - Glow Map-specific deployment details

- `LILBIRD-UPDATE-LOG.md`
  - every meaningful build, deploy, decision, or unresolved issue

- `nest/NEST-SETUP-GUIDE.md`
  - Luke-facing Nest setup and deploy paths

- `nest/NEST-AI-PAUSE-CHECKLIST.md`
  - verification before Nest debug; stops repeat fixes

- `nest/INVESTIGATION-SESSION-MISMATCH.md`
  - session UID vs entitlements postmortem

---

## Required Update Workflow

After any meaningful Lil Bird change, do this:

1. Update the relevant implementation files.
2. Update `LILBIRD-UPDATE-LOG.md` with:
   - date
   - area
   - what changed
   - whether it is only in repo or actually deployed
   - what still needs verification
3. Update the workstream-specific doc if architecture or behavior changed.
4. Update `LILBIRD-MASTER.md` if the change affects:
   - overall strategy
   - pricing policy
   - dashboard direction
   - shared system behavior

If the change touches pricing, booking, or deployment, explicitly note which surfaces were updated and which were not.

---

## Recommended Next Documentation Step

Claude and Luke should now refine the dashboard architecture section above with:

- the final auth model
- the actual purchase-to-entitlement flow
- whether First Flight lives inside the Nest or remains a lighter standalone entry
- what data must stay local versus what should move to Supabase
- how coach access works in practice

That dashboard section should now become the main architecture lens for the whole ecosystem.

---

## Quick Reference

If someone is new to Lil Bird, start here in order:

1. `docs/LILBIRD-MASTER.md`
2. `docs/LILBIRD-UPDATE-LOG.md`
3. `docs/CLAUDE-HANDOFF.md`
4. `docs/NEST-COMPREHENSIVE-AUDIT.md` (Nest security / wiring)
5. `nest/NEST-SETUP-GUIDE.md`
6. `CONTEXT-SITE-CHANGES.md`
7. Workstream docs when present: Inner Compass (`Deep-profile Cursor Project/PROJECT-CONTEXT.md`), Solo, Bridge

---

Last updated: 2026-05-28
