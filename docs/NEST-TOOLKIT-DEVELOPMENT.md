# Nest Toolkit — architecture for Tools for the Tangle and My Journey

Status: Milestone 1 is implemented on `feature/nest-toolkit`. `nest/journey-reflections.sql` is applied in Supabase. The Nest worker is already live at `v1.28-journey`, including `POST /journey/reflect`. This website branch is unpublished, so My Journey stays off lilbird.life until you ask to publish it. Local `main` still holds the unpublished Nest claim and was left as it is.

Reviewed from commit `5542ac0`, then built on that branch. The Pages repository is the Nest front end. The Nest worker source stays outside this repository, in the iCloud copy of `solo/worker-solo.js`, with `journey-reflect.js` beside it. Those worker files are not part of this branch.

What is already in place:

1. The table `public.journey_reflections` exists. A signed-in member can select, insert, and delete their own rows. There is no update policy.
2. The live worker answers `POST /journey/reflect` for a logged-in member and uses the existing model key. No new secret.

Publishing this branch is the remaining step before members see the new tab.

The Pages repository is the Nest, Solo, and Inner Compass front end. The Cloudflare Workers that authenticate API calls and store the Inner Compass live outside this repository, in the iCloud project copies of `solo/worker-solo.js` (Solo worker) and `Deep-profile Cursor Project/lilbird-assessment.js` (assessment worker). Findings below name which tree they come from.

---

## 1. Architecture findings

### 1.1 Nest navigation

`nest/index.html` is a logged-in dashboard. Guests see the auth screen. Members see four tabs, wired in `nest/nest-client.js`:

| Tab | Element | What it opens |
|---|---|---|
| My products | `#tab-products` / `#pane-products` | `renderProducts()` — plan badge and product cards |
| Life Canvas | `#tab-canvas` / `#pane-canvas` | `renderLifeCanvas()` |
| Inner Compass | `#tab-profile` | `openInnerCompassRead()`, not a normal pane switch |
| Ask lil' bird | `#tab-ask` / `#pane-ask` | In-Nest chat |

`setTab(name)` toggles `.dash-tab` and `.tab-pane`. A “Next steps” banner (`#next-steps-list`) sits above the grid for product tasks (finish a read, add a photo). The right column is `#sidebar-live-card`, `#sidebar-context-card`, `#sidebar-relationship-card`, and a chat hint.

Visual language already in use: `.dash-tab`, `.sidebar-card`, `.btn`, `.btn-gold`, `.btn-outline`, `.product-grid`, Tabler icons, `nest/nest-styles.css`. The tour is `nest/nest-tour.js`. New UI should extend these, not introduce a second look.

There is no Journey tab and no exercise library.

### 1.2 Authentication

Nest and Solo share one Supabase login. `nest/nest-client.js` creates the client with storage key `lilbird-solo-auth`. Sign-up is `sb.auth.signUp`. Sign-in is `sb.auth.signInWithPassword`. Logout clears that session.

`workerAuthHeaders()` and `nestAuthHeaders()` send `Authorization: Bearer <access_token>` to workers. The dashboard will not hydrate without `currentUser.id`.

Product access is a set of active rows in `user_entitlements` for that user (`hydrateDashboard()`). A free Nest exists. Nest Plus is a separate product. Solo does not include Nest Plus.

### 1.3 Supabase tables this feature touches

Defined in this repo by `nest/desk-and-merge.sql`, plus earlier SQL that created the account tables (iCloud `nest/user_entitlements.sql` and `nest/link-inner-compass.sql`). The live database is project `mebqqzbuwkogdxvnihrq`. This review did not query it.

| Table or function | Who can use it | Role for the toolkit |
|---|---|---|
| `auth.users` | Supabase Auth | The member id on every saved reflection |
| `user_entitlements` | Members `select` their own rows. Insert and update are revoked from `anon` and `authenticated`. The worker’s service role grants products. | Gate only if a later decision limits tools to Nest Plus |
| `deep_profile_links` | Members `select` their own row. `user_id` is the primary key, so one primary nest id. | The id used to load Life Canvas. Do not copy canvas data out of it. |
| `nest_reads` | Members `select` their own rows. | Extra Compass reads. Not required for milestone 1. |
| `link_deep_profile_to_user(text)` | `authenticated`, security definer | Attaches a nest id. The version in `desk-and-merge.sql` keeps the first read primary. |
| `course_users`, `session_progress`, `tool_outputs` | Used by Solo from the browser | Existing exercise storage. One row per user and tool name, upserted. |
| `account_merge_tokens`, `account_merges`, `live_sessions`, `live_roster`, `desk_alerts`, `staff_members`, `account_closes`, `premium_waitlist` | RLS on, granted to `service_role`, no member policies | Staff and live door. Leave them alone. |

`tool_outputs` is written directly by each Solo tool page, for example `tool-glow-map.html` and `tool-full-flight-plan.html`, with `onConflict: 'user_id,tool_name'`. A second completion replaces the first. The table’s RLS policies are not in this repository. Do not store Tangle reflections there until those policies are confirmed, and do not copy the upsert.

### 1.4 How a Solo tool saves

1. `solo/index.html` `openToolEmbed()` loads `solo/tools/tool-*.html` in an iframe.
2. The tool keeps answers in page memory, then upserts `tool_outputs` when the person saves.
3. The tool posts `tool-saved` or `tool-close` to the parent.
4. `applyToolSaveFromEmbed()` and `fetchToolOutputAfterClose()` refresh the chat card.
5. `triggerToolReturnAck()` calls the Solo worker `POST /chat` with `tool_return`. `handleToolReturn()` asks the model for two or three sentences. That text is a chat message in `ai_memory`, not a column on the tool row.
6. If the model fails, `buildToolReturnFallback()` still returns a short line. The save has already happened.

The tool page itself does not interpret the answers. Interpretation exists only inside an open Solo session.

### 1.5 Inner Compass and Life Canvas

The read is one JSON document in Cloudflare KV namespace `NEST_PROFILES`, keyed by nest id. It is not a Postgres row.

`GET /get-profile?nestId=` (`handleGetProfile` in the assessment worker) returns `profile` (stripped when unpaid), `canvasScores`, `canvasHistory` (up to 24 entries of `{ scores, overall, date }`), and access flags. The Nest applies that payload in `applyCanvasPayload()` and draws it in `renderLifeCanvas()`. A check-in calls `saveLifeCanvasCheckin()`, which `POST`s `/store-profile` with the new scores and one history entry. `handleStoreProfile()` ignores a date already stored and keeps the newest 24.

`canvasSynthesis` is prose written once when the Compass was generated. A later check-in does not call the model.

My Journey should link to this. The Life Canvas section should call the existing `setTab('canvas')` and the same `canvasScores` / `canvasHistory` already on the dashboard. It should not insert those scores into the reflections table.

### 1.6 Workers and request authentication

Solo worker, `getAuthUser()` in `worker-solo.js`: read `Authorization: Bearer`, then `GET {SUPABASE_URL}/auth/v1/user` with the service key as `apikey` and the member token as `Authorization`. Missing or invalid tokens return null. `/chat`, `/summarise`, `/session-email`, and `/solo-video-url` then require `userHasSoloAccess()` (a `solo_course` entitlement or a purchased `course_users` row). Nest routes such as `/nest-welcome-email` require `getAuthUser()` and do not require Solo.

Assessment worker: `/partner-dynamic` requires Nest Plus via `accountHasNestPlus()` or `readAccess()`. `/analyze` and `/get-profile` are keyed by nest id. `/store-profile` updates canvas history, scores, and email with the nest id and no login check.

Secrets (`SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`) are worker environment variables. They were not found in the Pages repository. The public Supabase anon key is embedded in the front end, which is how the Supabase browser client is configured. This document does not repeat it.

### 1.7 What can be reused

- Nest shell, tabs, sidebar cards, buttons, and type in `nest/index.html`, `nest/nest-client.js`, `nest/nest-styles.css`.
- Login and `workerAuthHeaders()`.
- Life Canvas read and check-in path. Do not build a second canvas.
- The idea of an optional, short, failure-tolerant reflection from `handleToolReturn()` / `buildToolReturnPrompt()`. Do not require a Solo session to get it.
- Stable exercise ids, the way Solo uses `glow-map` and `tool_name` `glow_map_s2`. Letters can later link to a slug.

What not to reuse as the storage engine: `tool_outputs` upserts, the iframe `token` query parameter in `openToolEmbed()`, and unauthenticated nest-id writes.

---

## 2. Security concerns

| Severity | Finding | Why it matters for this work |
|---|---|---|
| High | `handleStoreProfile()` and `handleGetProfile()` trust the nest id alone. A person who has the id can read canvas history and replace it. | My Journey must load canvas only for the nest id on the logged-in user’s `deep_profile_links` row. Do not accept a nest id from the address bar for a write. Do not store Tangle answers in that KV record. |
| High | Solo puts the member access token in the iframe URL (`openToolEmbed()`). URLs are copied into logs and history. | Run Tangle exercises in the Nest page. Send the token only as a header to the worker. |
| Medium | `tool_outputs` keeps one row per tool and overwrites it. Its RLS is not in this repo. | A new table, append-only from the member’s point of view, with policies in the same change as the table. |
| Medium | `link_deep_profile_to_user` is security definer and grants `inner_compass` to whoever submits a nest id while logged in. | Unrelated to Tangle saves. Do not extend this function to store reflections. |
| Low | KV reads expire one year after the last write (`saveRecord`, `expirationTtl: 31536000`). | Journey rows must live in Postgres so a reflection outlives a canvas rewrite. |
| Low | Coach replies can include a phrase from the exercise. That is intended. Logging the whole answer body is not. | The reflect endpoint logs slug, user id, and success or failure. It does not log answers, insight text, or emails. |

No service-role key, model key, or Stripe secret was found in the Pages tree. No customer rows were read for this review.

---

## 3. Recommended database schema

Applied on 26 Oct 2026 from `nest/journey-reflections.sql`. The sketch below is the review proposal. The live columns are `tool_id` and `tool_version`, recorded in that file.

```sql
create table public.journey_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tool_slug text not null,
  title text not null,
  answers jsonb not null,
  next_step text,
  insight text,
  created_at timestamptz not null default now(),
  constraint journey_reflections_slug_check check (tool_slug ~ '^[a-z0-9-]{2,40}$'),
  constraint journey_reflections_answers_size check (octet_length(answers::text) <= 20000)
);

alter table public.journey_reflections enable row level security;

create policy "members read own reflections"
  on public.journey_reflections for select to authenticated
  using (auth.uid() = user_id);

create policy "members insert own reflections"
  on public.journey_reflections for insert to authenticated
  with check (auth.uid() = user_id);

create policy "members delete own reflections"
  on public.journey_reflections for delete to authenticated
  using (auth.uid() = user_id);

revoke update on public.journey_reflections from anon, authenticated;
grant select, insert, delete on public.journey_reflections to authenticated;
```

Rules this shape is meant to keep:

- Each save is a new `id`. Repeating Boundary Untangler inserts another row.
- Nothing is written until the member presses Save. Closing or refreshing drops the in-memory answers.
- Delete is a real delete, so the reflection is gone, including the optional insight.
- Members cannot update a row. A correction is a new save. That avoids silent edits and keeps the worker from needing a service-role write for milestone 1.
- `insight` is null when they saved without AI, or when AI failed and they saved the exercise anyway.
- `next_step` is the one line My Journey lists under Your Next Steps. It is copied from the answers at save time so the list does not have to parse `answers`.

Applied indexes: `(user_id, created_at desc)` and `(user_id, tool_id, created_at desc)`.

`answers` for Boundary Untangler, one field for each of the five stages:

```json
{
  "situation": "A teammate, and the evening chat that keeps going.",
  "difficulty": "I worry the project will stall if I am not available.",
  "need": "Evenings that are actually off.",
  "boundary": "I can answer in the morning and still care about the work.",
  "nextStep": "Turn off chat notifications after 7pm this week."
}
```

---

## 4. Frontend structure

Stay inside the Nest. Add files rather than folding a long exercise into `nest-client.js`.

| Piece | Where | Job |
|---|---|---|
| Tab and pane | `nest/index.html` | `#tab-journey` “My Journey”, `#pane-journey`. A sidebar card `#sidebar-journey-card`. |
| Tab wiring | `nest/nest-client.js` `setTab` | Same pattern as products and canvas. |
| Preview card | new `renderJourneyPreview()` called from `hydrateDashboard()` | Latest next step, count of saved reflections, button to the tab. Empty state: one line and “Try a tool”. |
| Journey screen | new `nest/journey.js` | Three blocks: Your Next Steps, Your Reflections, Your Life Canvas. |
| Exercise runner | `nest/journey.js` | Opens a tool by slug, holds answers in memory, Save and Delete. |
| Exercise | `nest/journey.js` | Boundary Untangler, five stages, held in memory until Save. |
| Styles | `nest/nest-styles.css` | Reuse `.sidebar-card`, `.btn-gold`, `.btn-outline`, `.dash-tab`. |

My Journey contents:

- **Your Next Steps.** `next_step` from the member’s rows, newest first, with the tool title and date. Delete removes that row and its step. This is separate from the product banner `#next-steps-list`.
- **Your Reflections.** Each saved exercise: title, date, the answers, the insight if present. A delete control with a confirm. No edit.
- **Your Life Canvas.** A short reading of the current overall and the lowest area, using the scores already loaded. A button runs `setTab('canvas')`. If they have no Compass, the block links to Inner Compass the way the products pane already does.

Tools for the Tangle, milestone 1, is one card on My Journey: Boundary Untangler, about five to ten minutes.

Stages, in `nest/journey.js`:

1. Situation. Where does this feel tangled? Who is this with, and what keeps happening? (`situation`)
2. Difficulty. What makes it hard? What gets in the way of saying what you need? (`difficulty`)
3. Underlying need. What do you need underneath? Under the friction, what are you actually needing? (`need`)
4. Possible boundary. What boundary could you hold? Say it in a way that is clear and still kind. (`boundary`)
5. Next step. What is one realistic step? One thing you could do in the next week. (`nextStep`)

Buttons: “Reflect with lil’ bird” (optional), “Save to My Journey”, “Close without saving”. Save stays available when the reflection call fails. The insight, if it returns, is shown on the exercise and stored only if they then save.

A later letter can open `/nest/?tool=boundary-untangler`. Milestone 1 does not read that query yet. The slug is reserved now so the letter work does not need a rename.

---

## 5. Worker endpoints

Add one route on the Solo worker, which already has `getAuthUser()` and is the Nest’s worker (`SOLO_WORKER_URL` in `nest-client.js`).

`POST /journey/reflect`

- Require `getAuthUser()`. 401 when the token is missing. Any logged-in Nest member may call it. Solo access is not required.
- Body: `{ "toolId": "boundary-untangler", "toolVersion": 1, "answers": { "situation", "difficulty", "need", "boundary", "nextStep" } }`. Reject an unknown tool or version, and an oversized body. Each stage needs at least two characters.
- Call the model with a short system prompt: two or three sentences, one detail from their words, no advice list, no clinical claims. `max_tokens` around 400, same family as `handleToolReturn()`.
- On model failure, return `200` with `{ "insight": null, "degraded": true }`. The page tells them the exercise is still theirs to save.
- Do not write `journey_reflections`. The browser inserts the row through Supabase after an explicit Save, with the member JWT, so RLS applies.
- Do not log `answers` or `insight`.

No list endpoint and no delete endpoint. Select and delete go through Supabase as the member, which matches `user_entitlements` and `deep_profile_links`.

---

## 6. Milestone 1 implementation plan

After the decisions in section 7 are answered:

1. Add the approved SQL. Confirm a member can insert, select, and delete only their rows, and cannot update or read another member’s row.
2. Add the My Journey tab, empty states, and the sidebar preview. Life Canvas block links to the existing tab.
3. Build Boundary Untangler in memory, with Close without saving.
4. Save inserts a new row. A second completion does not change the first. Delete removes the row and the preview updates.
5. Add `POST /journey/reflect` behind the optional button. Ship the exercise so it still saves when that call fails.
6. Check the flow while logged in: products, Life Canvas, Inner Compass, and Ask still behave as they do now. Check a logged-out visit stays on the auth screen. Check mobile width for the new tab.

The SQL and the worker are done. The site is still unpublished. Do not merge to `main` until this branch has been reviewed.

Out of milestone 1: the other Tangle tools, the 26 letters, Nest Plus gating, and any change to Solo `tool_outputs`.

---

## 7. Decisions needed before building

1. **Who may open the tools.** This spec treats every logged-in Nest as allowed, including the free Nest. Say if Boundary Untangler should require Nest Plus instead.
2. **Approve the table** in section 3, including hard delete and no member update.
3. **Confirm `tool_outputs` RLS in Supabase** before any later work reads Solo answers into My Journey. Milestone 1 does not read that table.
4. **Insight voice.** Recommend the same short lil’ bird note as Solo’s tool return (one detail, one question, under 60 words). Say if a saved insight should be longer.
5. **Letter handoff.** Recommend reserving `boundary-untangler` and ignoring `?tool=` until the letter sequence exists. The current ten notes live in the assessment worker, not in this branch.

---

## 8. Boundary Untangler and the letters

The ten-note sequence already talks about a stuck place, two layers of a read, attachment, and one relationship. Boundary Untangler is the first exercise that can sit beside a later letter without a new personality test. It collects five stages: the situation, what makes it hard, the underlying need, a possible boundary, and one next step. None of that exists on the Inner Compass or in `tool_outputs`.
