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

The site and both workers answer. Coaching delivery is enabled on purpose. The cron is unchanged. The 28 October 2026 15:00 UTC window has passed on `v8.4.0-nest-live`. Delivery rows were not queried again during the authorization remediation, so the result of that run is unknown. The consent counts below are the 27 October observation: 2 due, 41 not enrolled, 1 historical failed row that is not due.

The service does not need to be disabled for this audit. The rollback remains the flag.

Local `main` at `443b8baf` was not merged and was not deployed.

## 8. Recommended next milestone

Watch the first general cron, then close the P1 gaps above. Do not start another product surface until those counts are in and the canvas write requires the signed-in owner.

A sensible following milestone, after that, is the Nest home a new member sees first: one path from the free account into My Journey, with product tasks and saved exercise steps clearly named. That is polish on a library that already exists, not a fourth build.

## Release A — corrected patch, not deployed

Checked 28 October 2026. Commit `b26d2d6` stays undeployed. Production `/ping` still returns `v8.4.0-nest-live` with `nestLetters: enabled`. Coaching delivery was not changed. `nest/release-a-claim.sql` was not applied. Local `main` was not touched.

The first patch closed Canvas reads for a signed-in non-owner, and it left four holes: the canvas secret had no expiry, `POST /link-to-course` could write `deep_profile_links` for any nest id presented with a valid launch token, `POST /analyze` with `retakeOf` could read and update another read, and `POST /partner-dynamic` plus Bridge create/join could use a stored profile when the caller had Nest Plus or only a nest id. This section describes the corrected patch.

### Ownership

`decideCanvasAccess` is the shared decision. An authenticated caller needs a verified relationship to that assessment. A nest id does not establish ownership. A course launch token does not establish ownership of an arbitrary assessment.

Proof, and what it may do:

| Proof | What it is | Read | New link, paid retake, or `nest_owner_emails` |
| --- | --- | --- | --- |
| `link` | A `deep_profile_links` row whose `ownership_proof` is `capability`, `read`, or `owner_email` | Yes | Yes, and a course link also needs the bound email to match the course member |
| `legacy` | A `deep_profile_links` row with no proof. Left in place. Not deleted. | No. Recovery is `confirm-results-email` and the body has no stored email | No. It does not open a profile, change a canvas, start a paid retake, create a link, or grant Inner Compass |
| `read` | Existing `nest_reads` row for this account and this nest | Yes | Yes, with the same email match for a course link |
| `email` | Signed-in email matches the email already stored on the read | Yes | No. This match kept current members able to open a read. It could be forged before this patch, so it does not create a link, copy paid status, or write `nest_owner_emails` |
| Capability | Unexpired token bound to this read, caller signed out | Yes, for two hours | Yes for the browser that just created the read. A signed-in non-owner is refused even with a valid token |
| Supabase session alone | A logged-in account with none of the rows above | No | No |
| Course launch token alone | Row in `deep_profile_launches` | No | No |
| Nest Plus or course enrollment alone | A product on the caller's account | No | No |

Existing `deep_profile_links` and `nest_reads` rows stay in place. `nest/release-a-links.sql` adds a nullable `ownership_proof` and does not update or delete existing rows. A null proof is `legacy`. `nest_reads` remains independent evidence because that row was written only after the owner-email check in the unapplied claim function, and the worker already required a `read` before a new course link. A legacy link plus a matching stored email still opens that member's own canvas through the email proof. The link itself adds nothing.

### Assessment capability token

The value is an assessment capability token. It is a time-limited secret for the browser that created that one read. It is not a single-use token. The quiz saves the read more than once, so the same token may be presented again until it expires.

- 32 cryptographically random bytes, sent as 64 hex characters, compared in constant time.
- `canvasTokenExpires` is stored on the read. Validity is two hours (`CANVAS_CAPABILITY_TTL_MS`). A missing or unparseable expiry is refused.
- Every use checks that stamp. A save refreshes the KV lifetime and does not move `canvasTokenExpires`. A paid-retake counter write keeps the original stamp.
- The token is bound to the read that issued it. It does not open another assessment.
- It does not override a signed-in ownership check.
- `/analyze` returns it once. `/get-profile` does not return it.
- Issued only when the read has no token yet.

### Secured routes

These routes load or change a stored assessment only after `decideCanvasAccess`, and the handlers below add the extra rule named:

- `GET /get-profile`, `POST /store-profile`, `GET /check-paid`, `POST /lead-unlock`, `POST /send-profile-email`, `GET /nest-preferences`, `POST /nest-preferences`
- `POST /link-to-course`: a valid launch token is not enough. `courseLinkDecision` must allow the caller before `deep_profile_links` is written. A refusal does not burn the launch token. The handler returns `403` and `{ error: "Not allowed" }`.
- `POST /analyze` when `retakeOf` is set: `retakeDecision` must allow the original before its paid flag, email, or retake counter is copied or incremented. A refusal does not save the new read and does not change the original. A nest id that already has any stored record also requires access before a new profile can be written onto it.
- `POST /partner-dynamic`: ownership is checked before the stored profile is used. Nest Plus is then a product gate on that authorized read (`record.nestPlus` or the caller's own Nest Plus). The partner's details are text the caller types. A missing Nest Plus returns `403` and `{ error: "nest_plus_required" }`.
- `POST /bridge/couple/create` and `POST /bridge/couple/join`: a profile object in the body is the participant's own disclosure. Loading a stored profile requires access. The old nest-id loader was removed. Each participant receives a secret once, stored only on that member row and returned as `participantSecret`. Later status responses omit it.
- `GET /bridge/couple/status`, `POST /bridge/checkin`, and `POST /bridge/generate`: `bridgeParticipantDecision` runs before any stored summary or check-in is read back. The caller needs `X-Bridge-Secret` or `participantSecret` for that member, or verified access to the nest already stored on that same member row. A couple id and a member id are not enough. A refusal is `404` and `{ error: "Not found" }` with no names, profiles, nest ids, or check-in text. `POST /bridge/translate` still uses the profiles in the request and does not load the stored couple.
- `POST /subscribe-email` merges an email onto a nest only after access, and only `mayRecordOwnerEmail` may write `nest_owner_emails`.
- `POST /analyze` for a brand-new id creates that read and may return the capability. It does not read another member's profile unless `retakeOf` passes `retakeDecision`.

`POST /preview-read`, `POST /mid-read`, and `POST /acknowledge` score the answers in the request. They do not load a stored assessment. `POST /glow-map-email` emails the scores in the request. `GET /letter-posts` is public letter metadata.

A refusal body is `{ error: "Please log in." }` with `401`, or `{ error: "Not allowed" }` with `403` or `404`. A signed-in caller whose only relationship is a legacy link also receives `recovery: "confirm-results-email"`. That hint does not include the stored email. Bridge refusals are `{ error: "Not found" }` and include no participant fields. None of these bodies include canvas scores, history, milestones, email, or the profile.

### Claim migration

`nest/release-a-claim.sql` and `nest/release-a-links.sql` are both unapplied. The claim file creates `nest_owner_emails` and replaces `link_deep_profile_to_user`. The links file adds `ownership_proof` and replaces that function again so a newly confirmed link stores `owner_email`. Both require `auth.uid()` and a matching email in `nest_owner_emails`. Neither sets `active = false` and neither deletes `user_entitlements` or existing links. The live function still grants `inner_compass` from a nest id alone. Do not run either file until the reviewed worker is deployed in the same change. If the worker is deployed before the column exists, a proof select fails closed: every link is treated as legacy, and a new proved insert fails instead of writing an unproved row.

### Legitimate workflows

- A member with a verified `deep_profile_links` proof, or a `nest_reads` row, can still open that assessment while signed in, without the capability token.
- A member whose only proof is the stored email can still open and update that canvas. They cannot start a paid retake, create a course link, or fill `nest_owner_emails` until a strong row exists. That is the migration: paid retakes and new course links need a verified `link` or `read`, or the two-hour capability from the browser that created the read.
- A member whose only relationship is a legacy link is refused. Recovery is to sign in with the address on the results email and open that read, or to write hello@lilbird.life from that address. The refusal does not return the stored address. Existing paid entitlements stay. A legacy Bridge session with a verifiable nest stays usable. A session with neither a secret nor a verifiable nest starts again. Secrets are not backfilled to an unverified caller.
- Inner Compass sends the capability on course link, on a paid retake (the original nest's token), and on Partner Dynamic, and it sends the session when the member is logged in. A course-link `403` clears the launch token only when the error names the launch token.
- Partner Dynamic and Relationship Dynamic show the Nest Plus offer only when the error is `nest_plus_required`.
- Bridge stays usable when the participant submits their profile in the body, or when they are allowed to load their own stored profile. Status, check-in, and generate also accept the participant secret from create or join, or verified access to the nest stored on that member. There is no Bridge client in this repository. A client that loads by nest id has to send the session or the capability, and a returning client has to keep the participant secret.
- Coaching email behavior in the unreleased worker matches the branch: explicit `test` or `general` mode, Resend idempotency on the delivery id, the same product sequences, Beehiiv left untouched by the letter files. The iCloud `nest-letters-worker.js` and `nest-letters-delivery.js` match the branch copies. Cron in `wrangler.toml` remains `0 15 * * *`.

### Existing ownership links

No production rows were changed. Successful `/link-to-course` calls were not stored with a proof of ownership. Worker request logs do not retain a history that can show whether a nest id was read or linked by someone other than the member. Classification: insufficient logging to determine whether unauthorized reads or link manipulation occurred. No confirmed misuse was identified, and that is not a finding that none occurred. Every current `deep_profile_links` row stays, with a null proof, until that member confirms the email already stored on the read. Paid entitlements are not revoked.

### Worker reconciliation

Live ping on 28 October 2026: `{"ok":true,"version":"v8.4.0-nest-live","nestLetters":"enabled"}`. The file prepared for a later deploy is `v8.5.2-release-a` in the iCloud `Deep-profile Cursor Project`. It is not the running worker. `v8.5.1-release-a` is the previous unreleased patch and is also not the running worker. `origin/main`'s letter worker still treats an empty allowlist as send-nobody. Deploying that file would stop general delivery while `/ping` could still say enabled.

`NEST_LETTERS_MODE` is not set in production. The corrected worker sends only when the flag is exactly `true` and the mode is exactly `test` or `general`. Deploying it without setting the mode to `general` in the same change would make the next cron send nobody. Secrets, the KV binding, the Resend idempotency key, delivery records, and the cron were not changed.

### Tests

68 tests passed on 28 October 2026: `node --test nest/nest-letters.test.mjs nest/canvas-access.test.mjs nest/journey-reflect.test.mjs nest/journey-tools.test.mjs`. The earlier letter, Journey, and tool tests are included. The canvas file covers a missing caller, a signed-in non-owner, a valid token that does not override that non-owner, expiry, reuse before expiry, a token presented to a different assessment, course-link refusals, email-only retake refusal, a legacy link that cannot read, retake, record an owner email, or create another link, a Nest Plus request for another member's profile, Bridge profile loads, Bridge status and check-in with only a couple id, a secret for the other participant, and a verified nest on the wrong member. One test reads the iCloud worker source and checks that status, check-in, and generate call the participant decision before they return a stored summary.

### Remaining risks

- Production still serves `v8.4.0-nest-live`, so the nest-id reads and the live claim function remain until a reviewed deploy.
- Historical `deep_profile_links` rows are not trusted. Logging still cannot show which ones were created through the old handler. A member who cannot match the stored results email needs the recovery path above.
- A capability leaked during its two-hour window can be reused until that stamp. It cannot be used by a signed-in non-owner, and a later save does not extend it.
- Email-only members can read and cannot take a paid retake or create a new course link until a `link` or `read` row exists.
- Bridge status, check-in, and generate refuse a caller who has only a couple id and a member id. A session created before participant secrets, whose nest cannot be verified, cannot be resumed. Translate still accepts profiles the caller puts in the request.
- The 28 October cron ran on `v8.4.0-nest-live`. See the section below. This patch did not send mail and did not change delivery rows.
- Supabase backup retention and a member account-close path remain open from the audit.

### First general letter run, 28 October 2026

The scheduled cron is `0 15 * * *`. Cloudflare recorded one successful `lilbird-assessment` invocation at 15:00:08 UTC, with 15 subrequests and no errors. That script is the live `v8.4.0-nest-live` worker. No records were updated for this check, and nothing was sent again.

In that same minute the worker made 13 calls to Supabase and 2 calls to Resend. Every Resend call returned 200. Supabase returned 8 reads or updates at 200, 2 creates at 201, and 3 updates at 204. Those counts match the letter store for exactly two due rows: one lock, one due-list read, two name lookups, two claim checks, two new delivery claims, two accepted sends, two sent marks, two sequence saves, and the lock release. They do not match a failed send, a held delivery, an uncertain delivery, or a third due row. The story sequence, the product flows, and the morning digest made no Resend call in that minute. Across 28 October this worker's only Resend calls were those two.

The live log line records `checked` whenever the skip count is zero, so it does not itself show how many letters were accepted. This reading is from the call counts, not from opening the delivery table. Recipient addresses were not read.

### Deployment is blocked on review

Stop here. When the patch is reviewed, the order is:

1. Publish this Pages branch first, so Inner Compass sends the session and the capability. The live worker ignores those headers, so this step does not close the hole and does not stop mail.
2. Apply `nest/release-a-claim.sql`, then `nest/release-a-links.sql`, on project `mebqqzbuwkogdxvnihrq`, immediately before the worker deploy. Do not re-run `nest-letters.sql` or `journey-reflections.sql`. Do not change existing entitlement rows and do not backfill `ownership_proof`.
3. In the same change, set `NEST_LETTERS_MODE` to `general` and deploy the iCloud assessment worker (`lilbird-assessment.js`, `canvas-access.js`, `nest-letters-worker.js`, `nest-letters-delivery.js`). Leave `NEST_LETTERS_ENABLED` true. Do not change the cron. Do not call the cron by hand. Do not deploy the worker from `origin/main`.
4. Confirm `/ping` shows `v8.5.2-release-a` and `nestLetters: enabled`. Repeat the auth checks with dedicated test records.

Pages should be merged with current `origin/main` before that publish, so the guide, avatar, layout, and product split already on `origin/main` stay in place. This security branch does not contain that product work. The interval to avoid is a worker that requires `ownership_proof` while the column is missing for longer than the deploy, and a worker that requires `NEST_LETTERS_MODE=general` while that variable is unset. Apply the SQL, set the mode, and deploy the worker as one change. The live `v8.4.0-nest-live` worker ignores the new headers, so publishing Pages first does not close the hole and does not stop mail.

Rollback: set `NEST_LETTERS_ENABLED` to `false` if a send must stop. To undo the worker, deploy `v8.4.0-nest-live` only together with removing `NEST_LETTERS_MODE`, because that older file treats a missing mode as general delivery when the flag is true. Leave `origin/main`'s worker undeployed. Restoring `link_deep_profile_to_user` from `nest/desk-and-merge.sql` would again grant Inner Compass from a nest id alone. Do not delete `user_entitlements` rows.
