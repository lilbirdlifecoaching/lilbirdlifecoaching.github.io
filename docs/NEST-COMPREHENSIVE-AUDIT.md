# Nest comprehensive audit

Date: 27 October 2026, afternoon Pacific.

This is an evidence review of My Journey, Tools for the Tangle, and Nest coaching emails. No production data was changed. No email was sent. No branch was merged. No worker was deployed. Local `main` is still `443b8baf` and was not checked out.

Release A is prepared on `feature/nest-release-a-security` and is not deployed. The production findings below stay in force until that deploy. See the Release A section at the end.

Production at the time of the review:

- Site: GitHub Pages `ad7ff21` (pull request 4), https://lilbird.life/nest/
- Assessment worker: `v8.4.0-nest-live`, deployment `0061f868-3fb0-45c8-8e3a-3d4b101b1641`
- Solo worker: `v1.29-tangle` at https://worker-solo.cwwq46sn7m.workers.dev/ping
- Coaching delivery: enabled
- Daily cron: `0 15 * * *` (8:00 AM Pacific)
- First general delivery: not yet. See the delivery section.

Completion below counts only rows in the requirements matrix. `ENHANCEMENT` rows are excluded. `UNVERIFIED` rows are not treated as complete.

## Requirements matrix

| Requirement | Planned behavior | Actual implementation | Evidence | Status | Severity | Recommended action |
| --- | --- | --- | --- | --- | --- | --- |
| My Journey is a Nest tab | A member opens My Journey from the dashboard, with a sidebar card. | `#tab-journey` and `#sidebar-journey-card` are on the live Nest. | `nest/index.html`; live page loads `journey.js?v=5`. | PASS | — | None. |
| Saved reflections sit at the top | After a save, the note is easy to find above the tool library. | `#journey-reflections` is the first block on the home screen. The save screen says “Saved to My Journey.” and offers “View saved reflection.” | Live `journey.js?v=5` `homeHtml` and `savedHtml`. | PASS | — | None. |
| A reflection belongs to one member | The row stores that member’s id. Another member cannot read, insert, or delete it. | Insert uses the signed-in id. RLS is select, insert, and delete where `auth.uid() = user_id`. There is no update grant. | `nest/journey-reflections.sql`; `buildInsertRow` in `nest/journey-reflect.js`; journey privacy tests. | PASS | — | None. |
| Save, then reopen | Save writes one row and the member can open it again. | Save inserts and returns an id. View opens that card. The live script contains this path. | `saveReflection` and `viewSaved` in `nest/journey.js`. A signed-in click was not repeated in this audit. | PASS | — | None. |
| Delete | The member can remove one of their own rows. | Delete confirms, then deletes by id and user id. The button is on each card. | `deleteReflection` in `nest/journey.js`. | PASS | — | None. |
| The same tool can be used again | A second completion is a new row. The first remains. | Every save is an insert. The table has no update policy, so a later save cannot replace an earlier id. | `journey_reflections` grants; `saveReflection`. | PASS | — | None. |
| A second AI read does not erase a saved row | Regenerating changes the note on screen. A later save stores that note as its own row. | `state.insight` is replaced in memory. Save inserts the current note only. An already saved row is left as it was. | `completionHtml` and `saveReflection`. | PASS | — | None. |
| The regeneration sentence matches that behavior | The member can tell that a new perspective replaces the unsaved note, not an older saved one. | The screen says “Another perspective replaces it.” That is true of the note on screen. It can be read as replacing the saved history. | Live `journey.js` line with that sentence. | PARTIAL | P2 | Say that a new perspective replaces the note on this page, and that an earlier saved reflection stays until it is deleted. No migration. Pages deploy. Retest save, regenerate, save again, and confirm two rows. |
| Timestamps | A saved reflection shows when it was kept. | `created_at` is stored in Postgres and shown as a date in `en-AU`, without the time of day. | `formatWhen` in `nest/journey.js`. | PARTIAL | P3 | Show the date and time if members need to tell two saves on the same day apart. No migration. Pages deploy. |
| Empty and failed saves | An empty Journey explains itself. A failed save keeps the answers and can be tried again. | Empty copy is “Nothing saved yet.” A failed insert keeps the draft and shows `SAVE_ERROR`. | `homeHtml`; `saveOutcome` in `nest/journey-session.js`; journey tests. | PASS | — | None. |
| Account switch and cross-account privacy | A reflection from one session cannot be written onto another member. | In-flight reflect and save checks are dropped when the member id changes. Reads are filtered with `.eq('user_id', user.id)` and by RLS. | `nest/journey-session.js`; `loadRows`; journey tests. | PASS | — | None. |
| Journey on a phone | The library and reflections fit a narrow screen. | Under 640px the grid is one column and the search field is full width. A signed-in phone pass was not repeated today. The preferences window was checked earlier at 390px. | `nest/nest-styles.css` around the 640px journey rules. | PASS | — | Spot-check one tool on a phone during the next signed-in pass. |
| Fifteen tools | Boundary Untangler plus fourteen more, each with its own questions. | Fifteen tools, versions all `1`, across six categories: relationships 4, myself 3, change 2, rhythms 3, family 2, work 1. | `TOOLS` in `nest/journey-tools.js`. Inventory in this document. | PASS | — | None. |
| Each tool can be finished, reflected, and saved | Stages, one next step, a grounded coaching note, a deep link, and a save. | Every tool has a `nextStep` stage. Eight tools have one optional stage. Reflect prompts include the member’s answers and forbid diagnosis. Deep links are `https://lilbird.life/nest/?tool=<id>`. Unknown tools are refused. | Tool inventory script; `journeyReflectSystem`; `nest/journey-tools.test.mjs`. | PASS | — | None. |
| Live model wording for every tool | The note uses the member’s words and does not make a clinical claim. | The prompt requires one detail from their words and forbids diagnosis. This audit did not send fifteen live model requests. | `journeyReflectSystem` and `journeyReflectPrompt`. | UNVERIFIED | P2 | Read one saved or freshly generated note per tool before calling the library finished. Do not treat the fallback sentence as that review. |
| Tools are part of the Nest, not a paid add-on | The library is available to a signed-in Nest member. A later decision could gate it. No such decision was made. | `journey.js` does not check Nest Plus. Any signed-in member can open a tool. | No entitlement check in `nest/journey.js`. | PASS | — | None. |
| The Nest reads as one home | Free Nest, Plus, Premium, Compass, Canvas, Journey, and email preferences are understandable, and a new member knows what to do first. | The tabs and the product cards exist. The free-plan sentence still lists the workbook, Glow Map, and quizzes, and does not mention My Journey. Product “Next steps” and Journey “Your next steps” are different lists with the same kind of name. | `renderPlan` in `nest/nest-client.js`; `#next-steps-list`; Journey home. | PARTIAL | P2 | Name the tools on the free plan, and distinguish product tasks from saved exercise steps. No migration. Pages deploy. |
| Subscription tiers | Free Nest, Nest Plus at $7.99 a month, Premium marked coming soon. Plus is not the Solo course. | Those prices and the coming-soon Premium card are on the signup screen and the product pane. Solo access is a separate entitlement. This audit did not start a checkout. | `nest/index.html` plan cards; `hasNestPlus` and `hasSoloAccess` in `nest/nest-client.js`. | PASS | — | None. |
| Welcome, 26 letters, and four check-ins | The approved sequence, subjects, preview text, tool links, voice, sender, and signature. | Render of the welcome, all 26 letters, and all 4 check-ins produced no audit problems and no “Note N of 26.” Sender is `lil' bird <hello@lilbird.life>`. Signature is Luke & the lil' bird team. | Local render of the worker copy of `nest-letters.js`, which matches the file deployed in `v8.4.0-nest-live`. `docs/NEST-LETTER-REVIEW.md` is checked by test. | PASS | — | None. |
| Letters do not look like a course | No visible sequence number in the header, footer, or progress line. | Numbered letters use an empty kicker. Welcome still says Welcome. Check-ins still say Life Canvas. | `renderNote` kicker rule; render script, `numberedWithSequence: 0`. | PASS | — | None. |
| Unsubscribe is visible and one-click capable | Each note has an unsubscribe URL, `List-Unsubscribe`, and `List-Unsubscribe-Post`. | The renderer sets those headers. The page explains that product notes are a separate switch. | `nest/nest-letters.js` headers; `handleUnsubscribe` in `nest-letters-worker.js`. | PASS | — | None. |
| A short Compass line when a name exists | Letters 4, 8, 13, 18, 23, and 26 may add one plain archetype sentence. Scores and clinical language are omitted. | The renderer can do that, and it rejects numbers, attachment, and long clinical text. The live cron always passes `profile: null`, so the sentence is never added. | `compassLine` in `nest/nest-letters.js`; `letterLoadContext` in `lilbird-assessment.js`. | PARTIAL | P2 | Load the member’s linked Compass name in `letterLoadContext`, or remove the promise from the operator notes. Worker deploy. Test a short name, a missing name, and a paragraph that must be dropped. |
| Inbox rendering of every note | HTML and plain text are readable on a phone. | HTML is a single dark table (`#1a1c23`) with a gold kicker. This audit did not open the notes in Gmail or Apple Mail. Letter 1 was accepted in the earlier live test. | `htmlShell` in `nest/nest-letters.js`. | UNVERIFIED | P3 | Open one numbered letter and one check-in on a phone after the first general send. |
| Signup consent | The coaching checkbox starts unticked. Leaving it unticked still creates a Nest. | The live checkbox has no `checked` attribute. The client reads it only as `checked === true`. | Live `https://lilbird.life/nest/` lines 59–60; `nest-client.js`. | PASS | — | None. |
| Existing members are not enrolled by launch | Turning delivery on does not create letter rows. | The cron only reads rows that already have `nest_coaching = true` and a due `next_at`. | `dueStates` in `nest-letters-delivery.js`. Counts below. | PASS | — | None. |
| A previous unsubscribe stays off until a fresh yes | Global or Nest unsubscribe blocks a new yes unless the member reaffirms. | `enroll` returns `unsubscribed` without `reaffirm`. The preferences window sends that flag when Nest coaching is turned back on. | `enroll` in `nest-letters-delivery.js`; preference tests. | PASS | — | None. |
| Global unsubscribe | `unsub:{hash}` stops the Nest note and does not by itself change Beehiiv. | At send time a suppressed member is saved as unsubscribed and skipped. The reflect and letter code do not call Beehiiv. | `runTick`; `letterFlags`; worker test `doesNotMatch` for beehiiv. | PASS | — | None. |
| Product coaching stays independent | Nest off does not turn product notes off. | Unsubscribe keeps `productCoaching` unless that switch was the one changed. Product flow names are unchanged. | `unsubscribe` and `PRODUCT_FLOWS`. | PASS | — | None. |
| Beehiiv stays separate | Nest signup and Nest preferences do not add or remove a newsletter subscriber. | The preferences window links to `https://lilbird.beehiiv.com/` and says this page does not add or remove anyone. | `nest/nest-letters-ui.js`. | PASS | — | None. |
| Each member has their own schedule | Welcome, then 14 days, then about 90 days. A purchase does not move the sequence. | `introDelayDays` 2, `intervalDays` 14, `checkinIntervalDays` 90. `applyAccountEvent` returns the same state. | `DEFAULT_SCHEDULE`; `advanceAfterSend`. | PASS | — | None. |
| One letter per member per step | A delivery id can be accepted once. A second cron does not send it again. Two crons cannot both hold the lock. | Idempotency-Key is the delivery id. Unique `(user_id, letter_key)`. `nest_letter_try_lock` is service-role only. | `nest-letters.sql`; delivery tests. | PASS | — | None. |
| Failed, uncertain, and held sends | A failure retries the same letter. An uncertain send does not move the step. After 24 hours an unrecorded claim is held, not sent again. | Implemented in `runTick`, `scheduleRetry`, and `claim`. One older unsent row is still `failed`. It belongs to an unsubscribed member, so the cron will not pick it up. | Tests; read-only count on 27 Oct 2026. Recovery steps are in `docs/NEST-LETTERS.md`. | PASS | — | Leave that failed row. Do not mark it sent unless the member actually received it. |
| Letter address follows the member | Mail goes to the address they use now. | The cron sends to `state.email`, copied at the last preference save. No path updates that address when the login email changes. | `runNestLetterCron` `to: state.email`. | PARTIAL | P2 | On each send, read the current auth email and skip if it is missing. Do not invent a migration. Worker deploy. Test a changed email before the next cron. |
| Account deletion removes Nest mail and reflections | Closing the account stops letters and deletes saved exercises. | Both tables reference `auth.users` with `on delete cascade`. No member-facing delete flow was found in the Nest page. `account_closes` is a staff table with no member policy. | `nest-letters.sql`; `journey-reflections.sql`; `desk-and-merge.sql`. | PARTIAL | P2 | Confirm the support procedure that deletes `auth.users`, and say so in the operator notes. No new table. |
| Turning notes back on does not restart the sequence | Step, phase, and welcome flag are kept. The next time becomes due. | `enroll` resumes when `welcomeSent`, `step > 0`, or phase is `checkin`. The test account is still `letters`, step 1, welcome sent. | `enroll`; read-only state check before launch, still consistent with due count 2. | PASS | — | None. |
| A missed cron sends later, once | If the worker is down at 15:00 UTC, the due row is still due the next day. The step does not skip. | `dueStates` uses `next_at <= now`. The step advances only after a recorded send. | `planSend` and `advanceAfterSend`. | PASS | — | None. |
| The first general run has been observed | After enabling delivery, one scheduled run is checked for counts only. | Delivery was enabled on 27 Oct 2026 after that day’s 15:00 UTC run. Since 19:00 UTC that day: 0 sent. Sent total is still 1. Unsent is still 1. Two members are due. | `/ping` enabled; read-only SQL. | UNVERIFIED | P1 | Read the worker log after 28 Oct 2026, 8:00 AM Pacific. Expect at most two notes: letter 2 for the test account, and the welcome for the other opted-in member. Do not send by hand. |
| Journey data rules are enforced in the database | Members can select, insert, and delete only their own rows. They cannot update. The worker does not write the table. | The migration says that, and it was applied on 26 Oct 2026. This audit did not re-list `pg_policies`. The live page inserts from the browser. | `nest/journey-reflections.sql`; live `insert(row)`. | PASS | — | Re-list policies once if a later change touches this table. |
| Letter rows are not member-writable | Service role only. | Grants to `anon` and `authenticated` are revoked. The preference route writes through the worker. | `nest/nest-letters.sql`. | PASS | — | None. |
| AI requests stay private | Reflect requires a login. Logs do not include the answers or the note. | `handleJourneyReflect` returns 401 without a user. Logs are `journey/reflect model status` and `model unreachable`. | `nest/journey-reflect.js`, also copied into the Solo worker path. | PASS | — | None. |
| Canvas writes belong to the signed-in member | A nest id from the request is not enough to replace a Compass or a canvas. | `handleStoreProfile` and `handleGetProfile` still load and save by nest id. Get-profile returns canvas scores and history. Store-profile can replace scores and append history with no login check in that function. | `lilbird-assessment.js` `handleStoreProfile`, `handleGetProfile`. Known before these milestones. | FAIL | P1 | Require the signed-in member’s `deep_profile_links` row before a canvas read or write. No Journey migration. Assessment worker deploy. Test a foreign nest id and expect a refusal. |
| Linking a Compass does not hand it to the wrong account | A logged-in member should attach only a read that is theirs. | `link_deep_profile_to_user` grants `inner_compass` to whoever submits a nest id. | `nest/desk-and-merge.sql`. Pre-existing. | PARTIAL | P1 | Confirm the support rule for who may submit a nest id. Do not widen this function. |
| Delivery can be stopped immediately | `NEST_LETTERS_ENABLED=false` skips the run before any send. | The new worker returned disabled before the flag was set, and enabled after. The flag is checked before the allowlist. | `/ping` on 27 Oct 2026; `runNestLetterCron`. | PASS | — | To stop mail, set the flag to `false`. Do not rely on an empty allowlist. |
| Held mail has a written recovery | A human can see a held row and record it sent only when the member already received it. | `docs/NEST-LETTERS.md` has the select and the guarded update. The cron does not resend after the 24-hour window. | That document; `claim` held branch. | PASS | — | None. |
| Someone can see a failed run without reading member mail | Failures, holds, and skips are visible as counts. | The cron writes `Nest letters:` to the worker log. There is no alert and no count dashboard. | `handleDailyCron` in `lilbird-assessment.js`. | PARTIAL | P1 | After the first run, save the log summary. Add a count-only alert before relying on the cron unattended. No member content in the alert. |
| Regression tests exist | Letter, Journey, and tool behavior is covered by automated tests. | 52 tests passed on 27 Oct 2026 before the flag was enabled. They do not prove the live model wording or the inbox. | `node --test` of the three Nest test files. | PASS | — | Keep the tests. Do not treat a green run as the end of the audit. |
| The published source matches the live sender | The repo that operators read describes the live gate. | Live behavior: flag on and an empty allowlist sends to members who already opted in. `origin/main` still says an empty allowlist sends nobody. The matching edit is only in the local working tree and was not committed. | `git log origin/main`; local `nest/nest-letters-worker.js`; live version `v8.4.0-nest-live`. | PARTIAL | P1 | Commit that gate change from `origin/main`, not from local `main`, and merge it when you want the published notes to match production. Until then, do not redeploy the assessment worker from the git copy of `nest-letters-worker.js`. |
| Backups | Letter state and reflections can be restored. | Supabase project backups were not inspected. | Not queried. | UNVERIFIED | P2 | Confirm the project’s backup retention in the Supabase dashboard. |

### Enhancements

These are not outstanding requirements.

| Requirement | Planned behavior | Actual implementation | Evidence | Status | Severity | Recommended action |
| --- | --- | --- | --- | --- | --- | --- |
| Time of day on a reflection | Not required. | Date only. | `formatWhen`. | ENHANCEMENT | P3 | Add the time if same-day saves become confusing. |
| Name the tools on the free plan card | Not required for the library to function. | The card lists other free pieces. | `renderPlan`. | ENHANCEMENT | P3 | One sentence on the free card. |
| Optional Compass sentence in the letters | The renderer supports it. The cron does not load a profile. | Covered as PARTIAL above. | `letterLoadContext`. | ENHANCEMENT | P3 | Do this only if the sentence is still wanted. |
| A member-facing account close button | Not part of the three milestones. | Not on the Nest page. | `nest-client.js`. | ENHANCEMENT | P3 | Add it when support wants members to close an account themselves. |

## Tool inventory

Each tool is version 1, ends in a next step, and opens at `https://lilbird.life/nest/?tool=<id>`. A question mark marks an optional stage. This audit checked the definitions and the automated tool tests. It did not submit fifteen live model requests.

| Tool | Category | Stages |
| --- | --- | --- |
| Boundary Untangler | Relationships | situation, difficulty, need, boundary, next step |
| Communication Reset | Relationships | said, meant, heard, unsaid?, sentence, next step |
| Connection Check | Relationships | who, warmth, distance, miss?, want, next step |
| Expectations Audit | Relationships | expectation, spoken, fair, origin?, kinder, next step |
| Shadows & Sparks | Myself | shadow, protects, spark, seen?, needs, next step |
| Identity Reflection | Myself | role, asks, remains, keep?, next step |
| Courage Compass | Myself | toward, holds, leave, need?, next step |
| Decision Clarity | Change & Decisions | decision, option A, option B, known, waiting?, next step |
| Transition Map | Change & Decisions | ending, middle, carry, leave?, next step |
| Energy Inventory | Life Rhythms | filled, drained, leak, postponed?, next step |
| Rhythm Reset | Life Rhythms | days, rushed, quiet, old?, next step |
| Rest or Escape? | Life Rhythms | reached, after, away, restores, signal?, next step |
| Family Expectations | Family | line, whose, now, instead?, next step |
| Responsibility Inventory | Family | yours, picked, if down, who?, next step |
| Workload Reset | Work & Purpose | plate, needs, wait, for?, next step |

The coaching prompts tell the model to use one detail from the member’s words, ask about the next step they chose, and not diagnose. Fallback text quotes their own step when they wrote one. That is the grounding control. It is not a review of live model output.

## How saved reflections are stored

`public.journey_reflections` is append-only from the member’s point of view.

- Columns: `id`, `user_id`, `tool_id`, `tool_version`, `answers`, `insight`, `next_step`, `created_at`.
- A save inserts a new id. Repeating a tool adds another row.
- Generating another perspective replaces `state.insight` on the page. It does not update a previous row.
- Saving after that second perspective stores only the note that was on screen.
- If the first perspective was already saved, that row remains. The new save is a second row.
- If the first perspective was never saved, it is not in the database. That is the intended “nothing is written until Save” rule.
- There is no edit. A correction is a new save or a delete.
- The worker does not write this table.

That model supports a history. It does not support editing one saved note in place, and it does not keep an unsaved first perspective beside the second one.

## Letter sequence

| Piece | Subject or role | Tool |
| --- | --- | --- |
| Welcome | A note every two weeks, if you want it | Nest home |
| 1 | When the day has no edges | Energy Inventory |
| 2 | A no that still leaves the relationship standing | Boundary Untangler |
| 3 | When the sentence lands somewhere else | Communication Reset |
| 4 | The race you did not enter | Transition Map |
| 5 | The quiet that is not peace | Communication Reset |
| 6 | The people who leave you smaller | Connection Check |
| 7 | Wanting, before you can name it | Decision Clarity |
| 8 | The yes you did not mean | Expectations Audit |
| 9 | When care starts to feel like a test | Family Expectations |
| 10 | When two people share a room and miss each other | Connection Check |
| 11 | The work that ate the evening | Workload Reset |
| 12 | The plan that did not happen | Shadows & Sparks |
| 13 | The door you keep circling | Courage Compass |
| 14 | What was never only yours | Responsibility Inventory |
| 15 | The difference between rest and leaving | Rest or Escape? |
| 16 | When your effort goes unseen | Identity Reflection |
| 17 | The conversation you keep postponing | Communication Reset |
| 18 | Confidence is a small return | Courage Compass |
| 19 | The story your family tells about you | Family Expectations |
| 20 | Standing in the fog | Transition Map |
| 21 | Choosing without a perfect map | Decision Clarity |
| 22 | When a friendship changes shape | Connection Check |
| 23 | Coming back to your own name | Identity Reflection |
| 24 | The heat under the politeness | Boundary Untangler |
| 25 | A beginning that does not erase the last one | Rhythm Reset |
| 26 | A year, seen from here | Shadows & Sparks |
| Check-ins | Four Life Canvas notes, about every 90 days | Life Canvas |

Tool links use the live Nest deep link. The linked tools are available to any signed-in Nest member, so a free member who gets a letter can open the tool.

## Delivery and consent counts

Read-only, 27 October 2026, after delivery was enabled and before the next cron.

| Count | Value |
| --- | --- |
| Sent since 19:00 UTC on 27 Oct 2026 | 0 |
| Sent in total | 1 |
| Unsent rows | 1, status `failed` |
| Due now, with an active opt-in | 2 |

The one sent row is the earlier Letter 1 test. The failed row is the earlier rejected test send and is not due, because that member is unsubscribed. The two due members are the internal test account, next note letter 2, and one other member waiting for the welcome. The other 41 Nest members have no due letter.

The next cron is 28 October 2026 at 15:00 UTC (8:00 AM Pacific). This audit did not trigger it.

## Issues

### P1 — Canvas can be read and written with a nest id

- Expected: a canvas change is accepted only for the nest linked to the signed-in member.
- What happens: `handleStoreProfile` updates scores and history for any nest id that already exists. `handleGetProfile` returns canvas scores and history for that id.
- Why it matters: someone who learns a nest id can read or replace that Life Canvas. Journey reflections are not in this store.
- Where: `Deep-profile Cursor Project/lilbird-assessment.js`, `handleStoreProfile` and `handleGetProfile`.
- Correction: require a logged-in user whose `deep_profile_links` row matches the nest id.
- Migration: no.
- Deploy: assessment worker.
- Test: a signed-in member can update their own canvas. A different nest id is refused. No letter send.

### P1 — Linking a Compass grants the product to the logged-in caller

- Expected: a nest id is attached only when it belongs to that person.
- What happens: `link_deep_profile_to_user` grants `inner_compass` to the caller who submits the id.
- Why it matters: a guessed or copied nest id can attach a read and grant the entitlement.
- Where: `nest/desk-and-merge.sql`.
- Correction: decide the support rule, then tighten the function if the id is not already known to that member.
- Migration: replace the function only after that decision. Do not run the whole file again.
- Deploy: database function only.
- Test: a foreign nest id does not grant `inner_compass`.

### P1 — The first general run has not been seen

- Expected: one scheduled run, then aggregate counts.
- What happens: delivery is enabled, and no general send has been recorded.
- Why it matters: the schedule, the consent filter, and Resend acceptance are not yet proven together on the open allowlist.
- Where: cron `0 15 * * *` in the assessment worker.
- Correction: wait for 28 Oct 2026, 8:00 AM Pacific. Read the `Nest letters:` log line and a count-only query.
- Migration: no. Deploy: no.
- Test: sent count rises by at most 2. No row is sent twice. The 41 members without consent gain no letter row.

### P1 — Failures are only in the worker log

- Expected: a failed, held, or skipped run is visible without opening member mail.
- What happens: `console.log('Nest letters:', …)` and `console.error` on a thrown cron error.
- Why it matters: a held letter or a provider failure can sit until someone happens to look.
- Where: `handleDailyCron` in `lilbird-assessment.js`.
- Correction: keep a count summary. Alert when `failed`, `uncertain`, or `held` is greater than zero.
- Migration: no. Deploy: assessment worker, after the first run is understood.
- Test: a forced failed send in a non-production store produces the alert and does not include an email address.

### P1 — Published sender source does not match the live gate

- Expected: the repo operators read describes the live rule.
- What happens: live `v8.4.0-nest-live` sends to opted-in members when the allowlist is empty. `origin/main` still says an empty allowlist sends nobody. The corrected file is an uncommitted local edit.
- Why it matters: a deploy that copies `nest/nest-letters-worker.js` from `origin/main` into the worker would stop general delivery while `/ping` still says enabled.
- Where: `nest/nest-letters-worker.js` on `origin/main`, versus the iCloud worker file that was deployed.
- Correction: commit and merge that gate change from published `main`, not from local `main`.
- Migration: no. Deploy: no, unless the worker is rebuilt. The live worker already has the new gate.
- Test: with the flag on and no allowlist, a consented due member is selected. With the flag off, the run returns `disabled`.

### P2 — “Another perspective replaces it”

- Expected: the member can see that a new note replaces the unsaved one, and that older saved notes remain.
- What happens: the sentence does not say “on this page.”
- Why it matters: a member may think saving again deletes the earlier reflection.
- Where: `completionHtml` in `nest/journey.js`.
- Correction: change the sentence. Do not change the insert.
- Migration: no. Deploy: Pages.
- Test: save, start again, generate another note, save, and see two cards.

### P2 — Free Nest copy and two “next steps”

- Expected: a new member can tell that the tools are in My Journey, and that product tasks are not the same list as saved exercise steps.
- What happens: the free plan line omits the library. The dashboard banner and My Journey both say next steps.
- Why it matters: the first visit does not point at the library that the letters link to.
- Where: `renderPlan` in `nest/nest-client.js`; `#next-steps-list`; Journey `Your next steps`.
- Correction: one sentence on the free card, and a clearer label on one of the lists.
- Migration: no. Deploy: Pages.
- Test: a new account sees My Journey named on the free card, and the two lists are visibly different.

### P2 — Compass sentence is never loaded

- Expected: six letters may add one short archetype sentence.
- What happens: `letterLoadContext` returns `profile: null`.
- Why it matters: the personalization described in the letter notes does not happen. The letters are otherwise complete.
- Where: `letterLoadContext` in `lilbird-assessment.js`.
- Correction: load the linked profile, or drop the sentence from the operator notes.
- Migration: no. Deploy: assessment worker if the load is added.
- Test: a short name appears once. A paragraph, a score, or a missing name adds nothing.

### P2 — Letter email can go stale

- Expected: the note uses the member’s current login email.
- What happens: the cron uses `state.email` from the last preference write.
- Why it matters: a changed login email can keep receiving, or stop receiving, at the old address.
- Where: `runNestLetterCron` in `nest-letters-worker.js`.
- Correction: resolve the current auth email at send time.
- Migration: no. Deploy: assessment worker.
- Test: change the auth email, leave the letter row untouched, and confirm the next send uses the new address.

### P2 — Account close is not a member path

- Expected: deleting the account removes letter state and reflections.
- What happens: the foreign keys cascade if `auth.users` is deleted. The Nest page has no close-account action.
- Why it matters: support needs a known procedure, or the rows remain.
- Where: `nest-letters.sql`, `journey-reflections.sql`, `account_closes` in `desk-and-merge.sql`.
- Correction: document the support deletion. Add a button only if members should do it themselves.
- Migration: no, while deletion is done by removing the auth user.
- Deploy: none for the cascade that already exists.
- Test: deleting a test auth user removes that user’s letter row and reflections.

### P3 — Reflection dates have no time

- Expected: two saves on the same day can be told apart.
- What happens: the card shows a date only.
- Where: `formatWhen` in `nest/journey.js`.
- Correction: append the time.
- Migration: no. Deploy: Pages.
- Test: two saves on one day show two different times.

### P3 — Inbox clients were not opened for the full set

- Expected: the dark note is readable as HTML and as plain text on a phone.
- What happens: the source renders both, and Letter 1 was received in the earlier test. The other 30 notes were not opened in a mail client this audit.
- Where: `htmlShell` and `textBody` in `nest/nest-letters.js`.
- Correction: open one fortnightly note and one quarterly note on a phone after the first general run.
- Migration: no. Deploy: no.
- Test: no sequence number, the tool or canvas link works, and the unsubscribe link is visible.

## 1. Executive summary

The three milestones are in production and match the plans that were merged. My Journey stores a private history of saved exercises. All fifteen tools are in the library, with their own questions, a next step, and a deep link. The welcome note, 26 letters, and four quarterly check-ins render without course numbers. Coaching delivery is on, and it selects only members who already opted in.

The first open send has not happened. Two members are due at the next cron. Forty-one are not.

The important gaps are older Nest protections and operations, not missing tools or missing letters. Canvas reads and writes still trust a nest id. The published git copy of the sender does not yet describe the live allowlist rule. Nothing alerts a person when a letter is held or rejected. Those should be understood before calling the whole Nest finished. They do not require turning delivery off.

## 2. Requirements completion

Matrix rows, enhancements excluded: 48.

| Status | Rows |
| --- | --- |
| PASS | 34 |
| PARTIAL | 9 |
| FAIL | 1 |
| UNVERIFIED | 4 |
| ENHANCEMENT | 4, excluded |

Completion is 34 / 48 = 71%. Partial, failed, and unverified rows are not counted as complete.

## 3. Verified completed functionality

- My Journey tab, saved reflections at the top, insert-only history, delete, empty and error states, and owner-only access in the schema and tests.
- Fifteen tools with categories, stages, next steps, non-clinical prompt rules, and Nest deep links. They are not behind Nest Plus.
- Welcome, letters 1–26, and four check-ins: subjects, preview text, tool or canvas links, dark campfire HTML, plain text, sender, signature, and no visible “Note N of 26.”
- Unticked signup consent, no automatic enrollment, reaffirm after unsubscribe, independent product coaching, and Beehiiv left as a separate list.
- Per-member timing: about two days to the first note, 14 days between letters, about 90 days between check-ins. A purchase does not move that timeline. Turning notes back on does not reset the step.
- Idempotent delivery ids, a cron lock, and hold-after-24-hours behavior, covered by tests.
- Live flag: `/ping` reports `v8.4.0-nest-live` and coaching delivery enabled. Since enable, sent count is still 1 and new sends are 0.
- Rollback is `NEST_LETTERS_ENABLED=false`. An empty allowlist does not mean “send nobody” on the live worker.

## 4. Outstanding issues by severity

P1

- Canvas get and store still trust a nest id.
- Submitting a nest id can grant Inner Compass.
- The first general cron has not been observed.
- Failed and held letters are only in the worker log.
- `origin/main` still documents the old allowlist gate.

P2

- “Another perspective replaces it” can be misread.
- The free plan copy and the two next-step lists are easy to confuse.
- The optional Compass sentence is never loaded.
- A changed login email is not picked up by the letter row.
- Account deletion depends on removing the auth user, and that procedure is not on the Nest page.

P3

- Reflection cards show a date without a time.
- The full letter set has not been opened in a phone mail client.

## 5. Recommended fixes before calling the project complete

Do these before a new milestone. Do not turn delivery off to do them, unless a check after the first cron shows the wrong people were mailed.

1. On 28 Oct 2026 after 8:00 AM Pacific, record sent, failed, held, and skipped counts. Confirm the two due members were the only candidates, and that no second copy was sent.
2. Publish the live allowlist rule into the git repo from `origin/main`, so a later worker deploy cannot silently restore “send nobody.”
3. Require the signed-in owner for canvas reads and writes.
4. Add a count-only signal for failed, uncertain, and held letters.
5. Clarify the regeneration sentence so saved history is obviously kept.

Items 3 and 4 need an assessment worker deploy. Item 5 needs a Pages deploy. Item 2 needs a merge, not a worker deploy, because the live worker already has the new gate. None of these need a new table.

## 6. Optional future improvements

- Show the time on a saved reflection.
- Mention My Journey on the free plan card, and rename one of the next-step lists.
- Load a short Compass name into the six letters that can use it, or delete that promise from the notes.
- Resolve the current auth email at send time.
- Write down, or build, a member account-close path that deletes the auth user and therefore the cascaded rows.
- Review the Compass-link function before more people share nest ids.
- Confirm Supabase backup retention.
- Read one live coaching note from each tool.

## 7. Production health

The site and both workers answer. Coaching delivery is enabled on purpose. The cron is unchanged. No general send has been recorded yet. Consent counts still match the launch decision: 2 due, 41 not enrolled, 1 historical failed row that is not due.

The service does not need to be disabled for this audit. The rollback remains the flag.

Local `main` at `443b8baf` was not merged and was not deployed.

## 8. Recommended next milestone

Watch the first general cron, then close the P1 gaps above. Do not start another product surface until those counts are in and the canvas write requires the signed-in owner.

A sensible following milestone, after that, is the Nest home a new member sees first: one path from the free account into My Journey, with product tasks and saved exercise steps clearly named. That is polish on a library that already exists, not a fourth build.

## Release A — prepared, not deployed

Checked 27 October 2026. The live assessment worker is still `v8.4.0-nest-live`. This section describes the branch. It does not describe a production change.

### Confirmed before the fix

Unauthorized Canvas access was possible in the worker source. `handleGetProfile` and `handleStoreProfile` trusted the nest id. A request with no login received canvas scores, canvas history, milestones, the email on the read, and, when `record.paid` was true, the full profile. `readAccess` copied `record.paid` before it checked the caller. `handleStoreProfile`, `handleLeadUnlock`, `handleSendProfileEmail`, and `handleNestPreferences` could write canvas fields or replace the email on an unpaid read with no login. There is no separate canvas delete route. Replacing scores is the delete-and-write, and it used the same unauthenticated path.

This was not demonstrated against a member's live nest id. The handlers themselves accept the call. Nest ids are in results links (`?nest=`), so the id is not a secret.

`link_deep_profile_to_user` grants `inner_compass` to any signed-in caller who submits any nest id. It does not check a purchase or an email. That function is still the live database function. The replacement is `nest/release-a-claim.sql`. It has not been run.

### Authorization on the branch

Canvas reads and writes (`/get-profile`, `/store-profile`, `/check-paid`, `/lead-unlock`, `/send-profile-email`, `/nest-preferences`) call `canvasAccessDecision`.

- No caller: `401` and `{ error: "Please log in." }`. No canvas, email, or profile.
- A signed-in account that does not own the nest: `403` and `{ error: "Not allowed" }`.
- Ownership is a `deep_profile_links` row, a `nest_reads` row, or an exact match between the account email and the email already stored on the read.
- A signed-in non-owner is refused even if they also send the creating-session token.
- The browser that just finished `/analyze` receives a `canvasToken` once. That token is stored on the read and in `sessionStorage`. It is not returned by `/get-profile`. It lets that browser save the new read before an account exists. It is not the nest id.
- A different email never replaces an email already stored.
- The claim function raises `not allowed` unless `auth.uid()` is set and `auth.jwt() email` matches `nest_owner_emails`. It does not set `active = false` and it does not delete entitlement rows. Existing access stays until a separate review.

### Worker differences

Compared with `origin/main`, the live `nest-letters-worker.js` has two differences, and both are kept:

- Empty allowlist with the flag on sends to members who already opted in. `origin/main` returns `skipped: allowlist` and sends nobody.
- `deliverNestLetter` keeps `providerStatus`, `providerName`, `providerMessage`, and `providerId` on the Resend result.

`nest-letters.js`, `nest-letters-delivery.js`, and `nest-letters-copy.js` matched the live copies apart from the new `due` count on the run summary.

The branch then makes delivery fail closed. `NEST_LETTERS_MODE` must be `test` or `general`. An unset or invalid mode sends nobody. `test` with an empty allowlist sends nobody. `general` sends only to members who already opted in, and a non-empty allowlist still limits that run. Deploying this worker without setting `NEST_LETTERS_MODE=general` in the same change would stop the next cron. That secret is not set, and this branch is not deployed. Live delivery stays as it is: flag true, no allowlist, general send to opted-in members.

### Delivery monitoring

A completed cron writes KV key `nest-letters:last-run` with counts only: due, accepted, failed, held, uncertain, deferred, skipped, mode, and `finishedAt`. No email and no user id. A reporting failure does not change who was sent. The cron does not resend a held or uncertain letter. The daily review steps are in `docs/NEST-LETTERS.md`. The live worker does not write this key yet.

### First general send

Pending. The run is scheduled for 28 October 2026 at 15:00 UTC. It has not happened. No manual send was made. Coaching delivery stays enabled.

### Tests

57 tests passed on 27 October 2026: `node --test nest/nest-letters.test.mjs nest/canvas-access.test.mjs nest/journey-reflect.test.mjs nest/journey-tools.test.mjs`. That includes the existing Journey, tool, and letter tests, plus cross-account canvas refusal, an unauthenticated canvas request, unauthorized and matching Inner Compass claims, the claim file not revoking entitlements, disabled / test / general delivery, an unset mode, a concurrent cron, and failed or uncertain delivery counts.

### Still open in production

- Canvas and claim authorization, until the reviewed worker and `nest/release-a-claim.sql` are deployed together.
- The first general send.
- Supabase backup retention was not inspected.
- Account deletion still has no member-facing control.
- Letters still do not load the optional Compass sentence.
- Pre-existing entitlements and links were not revoked.

### Deployment is blocked on review

Do not deploy this branch yet. When it is reviewed, the order is:

1. Publish the Pages branch first, so the Nest and Inner Compass send the session or the canvas token. The current worker ignores the token, so this step does not close the hole and does not stop mail.
2. Apply `nest/release-a-claim.sql` on project `mebqqzbuwkogdxvnihrq`. Do not re-run `nest-letters.sql` or `journey-reflections.sql`. New claims fail closed until the worker writes `nest_owner_emails`. Existing entitlement rows are not changed.
3. In the same change, set `NEST_LETTERS_MODE` to `general` and deploy the assessment worker from the iCloud `Deep-profile Cursor Project` copies of `lilbird-assessment.js`, `canvas-access.js`, `nest-letters-worker.js`, and `nest-letters-delivery.js`. Leave `NEST_LETTERS_ENABLED` true. Do not change the cron. Do not call the cron by hand.
4. Confirm `/ping` shows `v8.5.0-release-a` and `nestLetters: enabled`.

Rollback: set `NEST_LETTERS_ENABLED` to `false` if a send must stop. To undo the worker, deploy the previous version `v8.4.0-nest-live` only together with removing `NEST_LETTERS_MODE` or leaving it unset, because that older file treats a missing mode as general delivery when the flag is true. Do not deploy `origin/main`'s worker. It would send nobody while the flag still says enabled. The claim function can be restored from `nest/desk-and-merge.sql` only for that function, and only if the new claims must be relaxed again. Restoring it re-opens the nest-id grant. Do not delete `user_entitlements` rows.
