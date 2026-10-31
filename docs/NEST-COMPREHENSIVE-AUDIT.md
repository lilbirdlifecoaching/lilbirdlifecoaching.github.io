# Nest comprehensive audit

Refreshed 30 October 2026, after Release A. This replaces the 27 October status. The Release A notes at the end were written before that deploy and stay as the record of the trust model.

No email was sent. The cron was not triggered. No SQL migration was run. No member row was changed. Local `main` is still `443b8baf` and was not checked out.

Production at this refresh:

- Site: GitHub Pages merge `3a3aef12` (pull request 10), https://lilbird.life/nest/
- Live Nest HTML serves `nest-client.js?v=55` and `journey.js?v=7`. The free-plan sentence is still “Glow Map, quizzes, letters if you opt in, and the First Flight workbook.” The word `checked` does not appear on that page.
- Assessment worker: `v8.5.2-release-a`, deployment `e5ba2a17-553e-4d1a-b4f3-bec81bbb4163`
- `/ping`: `{"ok":true,"version":"v8.5.2-release-a","nestLetters":"enabled"}`
- `NEST_LETTERS_MODE=general`. Cron remains `0 15 * * *`. `NEST_LETTERS_ENABLED` was left in place.
- Database `mebqqzbuwkogdxvnihrq`, branch main Production. Read-only counts on 30 October: 18 entitlements, all active, 5 active Inner Compass, 5 links, all with a null ownership proof, 0 owner-email rows, 0 reads, 5 deliveries (4 sent, 1 failed), 3 letter-state rows, 2 with coaching on, 0 due.
- The count-only key `nest-letters:last-run` is absent. Worker `v8.5.2` writes it, and no cron has run on that worker yet. Today’s 15:00 UTC cron ran before the 22:38 UTC deploy, on `v8.4.0-nest-live`.
- Supabase scheduled backups: the dashboard says the Free plan does not include project backups.

Completion counts only the 48 matrix rows. Enhancement rows are excluded. A row is complete only when this refresh could point at production behavior, a production policy or count, or an automated test that executes the rule. A file that merely contains the feature is not enough.

B1 copy is in the working tree on `feature/nest-release-b` and is not published. The matrix describes production.

## Requirements matrix

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 1 | My Journey is a Nest tab | Complete and verified | Live `nest/index.html` has `#tab-journey` and `#sidebar-journey-card`. `journey.js?v=7` is the published script. |
| 2 | Saved reflections sit at the top | Complete and verified | `homeHtml` in published `nest/journey.js` renders `#journey-reflections` before the exercise steps and the library. |
| 3 | A reflection belongs to one member | Complete and verified | Production `pg_policies` for `journey_reflections` are DELETE, INSERT, and SELECT. There is no UPDATE policy. `user_id` references `auth.users` on delete cascade. Journey privacy tests pass. |
| 4 | Save, then reopen | Complete and verified | `saveReflection` inserts and `viewSaved` opens that card. The save tests pass. A signed-in click on the live site was not repeated on 30 October. |
| 5 | Delete | Complete and verified | `deleteReflection` deletes by id and user id. The delete test passes. A signed-in click was not repeated on 30 October. |
| 6 | The same tool can be used again | Complete and verified | Every save is an insert. Production grants no update. The two-save test passes. |
| 7 | A second AI read does not erase a saved row | Complete and verified | `state.insight` is replaced in memory. Save inserts the current note. The tests cover a second row and a late response that must not land. |
| 8 | The regeneration sentence matches that behavior | Partially implemented | Production `journey.js?v=7` says “Saving keeps this note. Another perspective replaces it.” The insert behavior is correct. The sentence can be read as replacing saved history. B1 changes the sentence on this branch and is not deployed. |
| 9 | Timestamps | Partially implemented | `created_at` is stored and `formatWhen` shows a date in `en-AU`, without the time of day. Two saves on one day look the same. |
| 10 | Empty and failed saves | Complete and verified | Empty copy is “Nothing saved yet.” A failed insert keeps the draft. Tests cover the network failure and the retry. |
| 11 | Account switch and cross-account privacy | Complete and verified | In-flight reflect and save are dropped when the member id changes. Reads filter on `user_id`. Tests pass, and the production policies match. |
| 12 | Journey on a phone | Complete and verified | Under 640px the published stylesheet makes the grid one column and the search field full width. The B1 browser pass checks the signup card at 390px. A signed-in phone pass of a finished tool was not repeated. |
| 13 | Fifteen tools | Complete and verified | `TOOLS` in `nest/journey-tools.js` has fifteen tools, version 1, across six categories. The library test passes. |
| 14 | Each tool can be finished, reflected, and saved | Complete and verified | Every tool has a next-step stage. Reflect prompts forbid diagnosis. Deep links are `https://lilbird.life/nest/?tool=<id>`. Unknown tools are refused. Tool tests pass. |
| 15 | Live model wording for every tool | Implemented but not verified in production | The prompt requires one detail from the member’s words and forbids diagnosis. This refresh did not send fifteen live model requests. |
| 16 | Tools are part of the Nest, not a paid add-on | Complete and verified | Published `journey.js` has no Nest Plus check. Any signed-in member can open a tool. |
| 17 | The Nest reads as one home | Partially implemented | Tabs, prices, and product cards are on the live page. The free-plan sentence omits My Journey. The sidebar checklist and My Journey both use a “next steps” name for different lists. B1 renames them on this branch and is not deployed. |
| 18 | Subscription tiers | Complete and verified | Live signup cards: Free Nest, Nest Plus at $7.99 a month, Nest Premium marked coming soon. Plus is the guide, full read, Life Canvas, Relationship Dynamic, and Roots & Wings. The Intensive workbook is also $27 on its own. Solo is Nest Premium or $197. First Flight the session is $149 and is not included in Free Nest. The First Flight workbook is. |
| 19 | Welcome, 26 letters, and four check-ins | Complete and verified | Letter tests render the welcome, all 26 letters, and the check-ins. Sender is `lil' bird <hello@lilbird.life>`. The deployed letter files match the published copies from the Release A deploy. |
| 20 | Letters do not look like a course | Complete and verified | Numbered letters use an empty kicker. The render test reports no “Note N of 26.” |
| 21 | Unsubscribe is visible and one-click capable | Complete and verified | The renderer sets the unsubscribe URL, `List-Unsubscribe`, and `List-Unsubscribe-Post`. Preference tests pass. A mailbox was not opened on 30 October. |
| 22 | A short Compass line when a name exists | Partially implemented | `compassLine` in `nest-letters.js` can add one sentence on letters 4, 8, 13, 18, 23, and 26, and it drops numbers, attachment language, and long text. `letterLoadContext` in the deployed worker returns `profile: null`, so the sentence is never added. The letter still sends. |
| 23 | Inbox rendering of every note | Implemented but not verified in production | HTML is one dark table and plain text is rendered. Letter 1 was accepted in an earlier test. The other notes were not opened in a mail client during this refresh. |
| 24 | Signup consent | Complete and verified | The live Nest page has no `checked` attribute. The client treats the box as on only when `checked === true`. The consent test passes. |
| 25 | Existing members are not enrolled by launch | Complete and verified | The cron reads `nest_coaching = true` and a due `next_at`. Production has 3 letter-state rows, 2 opted in, and 0 due. |
| 26 | A previous unsubscribe stays off until a fresh yes | Complete and verified | `enroll` returns `unsubscribed` unless the member reaffirms. The preference test passes. |
| 27 | Global unsubscribe | Complete and verified | `unsub:{hash}` is checked at send time. The letter files do not call Beehiiv. Tests pass. |
| 28 | Product coaching stays independent | Complete and verified | Unsubscribe keeps `productCoaching` unless that switch was the one changed. Tests pass. |
| 29 | Beehiiv stays separate | Complete and verified | The preferences window links to Beehiiv and says this page does not add or remove anyone. The worker source test still fails if the letter files call Beehiiv. |
| 30 | Each member has their own schedule | Complete and verified | Welcome delay 2 days, letters every 14 days, check-ins about every 90 days. `applyAccountEvent` does not move the sequence. Tests pass. |
| 31 | One letter per member per step | Complete and verified | Idempotency-Key is the delivery id. Unique `(user_id, letter_key)`. The lock is service-role only. A second-cron test passes. |
| 32 | Failed, uncertain, and held sends | Complete and verified | A failure inside the 24-hour window retries the same letter. After that window `claim` holds the row and does not send it again. An uncertain send does not move the step. Production has one failed row and zero uncertain rows. See the n01 note in Release B. |
| 33 | Letter address follows the member | Partially implemented | New enrollment stores the confirmed auth email. The cron sends to `state.email` from the last preference write. `letterLoadContext` already loads the auth user and ignores `user.email`. A later confirmed email change is not picked up. |
| 34 | Account deletion removes Nest mail and reflections | Partially implemented | Several tables cascade from `auth.users`. There is no member-facing close flow and no confirmation message. Delivery rows, owner-email rows, and Cloudflare KV do not follow the auth user. The retention plan is below. It is not built. |
| 35 | Turning notes back on does not restart the sequence | Complete and verified | `enroll` resumes when the welcome was sent, the step is past zero, or the phase is `checkin`. The test passes. |
| 36 | A missed cron sends later, once | Complete and verified | `dueStates` uses `next_at <= now`. The step advances only after a recorded send. Tests pass. |
| 37 | The first general run has been observed | Complete and verified | On 28 October the 15:00 UTC cron on `v8.4.0-nest-live` made two Resend calls, both 200, matching two due letters. Production now has 4 sent and 1 failed. The failed row is the 27 October n01, not a new failure. Nothing was sent by hand on 30 October. |
| 38 | Journey data rules are enforced in the database | Complete and verified | Production policies on 30 October are DELETE, INSERT, and SELECT. Authenticated grants were not re-listed as a separate privilege string. The policy list is the member surface. |
| 39 | Letter rows are not member-writable | Complete and verified | `nest-letters.sql` revokes `anon` and `authenticated` and enables RLS. Members change preferences through the worker. Grants were not re-counted on 30 October. No later migration reopens those tables. |
| 40 | AI requests stay private | Complete and verified | `handleJourneyReflect` returns 401 without a user. Logs are status lines, not the answers. The guide route refuses a stranger and a free member before the model call. Tests pass. |
| 41 | Canvas writes belong to the signed-in member | Complete and verified | Deployed `decideCanvasAccess` gates get, store, and the other private routes. On 30 October a signed-out read returned 401, a signed-in non-owner read and write returned 403 with no profile, and the matching owner could read and save. Disposable records were removed. |
| 42 | Linking a Compass does not hand it to the wrong account | Complete and verified | `link_deep_profile_to_user` requires `auth.uid()` and a matching `nest_owner_emails` row. An unauthorized claim returned `not allowed`. A matching disposable claim wrote `ownership_proof = owner_email` and was then removed. Entitlements are back to 18, all active. |
| 43 | Delivery can be stopped immediately | Complete and verified | `/ping` reports coaching enabled only when the send gate is open. The gate requires `NEST_LETTERS_ENABLED` true, mode `general` or `test`, and a mailing address. The flag was not turned off during this refresh. |
| 44 | Held mail has a written recovery | Complete and verified | `docs/NEST-LETTERS.md` has the count query and the guarded updates. The cron does not resend a held row. That document still says the live worker is `v8.4.0` and does not write `nest-letters:last-run`. The code in `v8.5.2` does write it. The document is behind the deploy. |
| 45 | Someone can see a failed run without reading member mail | Partially implemented | The cron logs `Nest letters:`. `v8.5.2` also writes count-only `nest-letters:last-run`. That key is absent because no cron has run since the deploy. There is no alert. The delivery table has no provider-error column. |
| 46 | Regression tests exist | Complete and verified | 75 tests passed on 30 October across canvas access, the guide, Journey reflect, Journey tools, and letters. They do not prove live model wording or a mail client. |
| 47 | The published source matches the live sender | Complete and verified | `origin/main` is `3a3aef12`. The deployed worker is the reviewed `v8.5.2-release-a` copy, with mode `general`. An empty allowlist under that mode sends to consented members. Deploying `origin/main` from before pull request 10 would have been the old gate. That is not what is running. |
| 48 | Backups | Not implemented | The Supabase backups page for this project says the Free plan does not include project backups. Point-in-time recovery was not enabled on that page. Cloudflare KV backups were not found. |

## Enhancements

These are not part of the 48. They stay optional.

| Item | Status | Note |
| --- | --- | --- |
| Time of day on a reflection | Enhancement. Also row 9, which stays partial. | Add the time only if same-day saves become confusing. Not in B1. |
| Name My Journey on the free plan | Row 17. B1 does this. | It was optional for the library to function. The home-page requirement already asked for it. |
| Compass sentence | Row 22. B2, not started. | The renderer is ready. The cron does not load a profile. |
| A member-facing account close button | Row 34. B4 plan only. | Do not build it until the retention plan is accepted. |

## Completion

48 required rows.

| Status | Rows |
| --- | --- |
| Complete and verified | 38 |
| Partially implemented | 7 |
| Implemented but not verified in production | 2 |
| Not implemented | 1 |
| Superseded by a later product decision | 0 |

Completion is 38 / 48 = 79%. Partial, unverified, and not-implemented rows are not counted as complete.

The seven partial rows are 8, 9, 17, 22, 33, 34, and 45. The two unverified rows are 15 and 23. The missing row is 48, backups.

## What changed since 27 October

Release A closed the two P1 authorization holes. Canvas reads and writes go through `decideCanvasAccess`. A nest id does not grant Inner Compass. The first general letter run happened on 28 October. The published site and the live sender now describe the same gate. Coaching is still on. Entitlements were not reduced.

## Prioritized remaining issues

### P1 — No database backups

The Free plan page says project backups are not included. A mistaken delete, or a project failure, cannot be restored from Supabase. This is an operational risk. It is not a member-facing bug. Do not turn mail off because of it. Decide whether the project should move to a plan that keeps backups before any account-deletion tool exists.

### P1 — A failed letter is still easy to miss

`v8.5.2` can write a count-only report, and that report does not exist yet. There is no alert. The 27 October n01 failure has no stored provider reason. Leave that row alone. Read `nest-letters:last-run` after the 31 October 15:00 UTC cron. Do not trigger the cron to create the key.

### P2 — A legitimate member can open a read and still not claim it

Email match opens that member’s own canvas and does not write `nest_owner_emails`. A legacy link is not trusted. The claim function then refuses. Existing Inner Compass grants stay. The recovery design is in B3. It is not built.

### P2 — An unauthorized paid retake can reach the model

For a brand-new nest id, `handleAnalyze` calls Anthropic before `inheritPaidRetake`. The refusal does not save the profile. An existing partial record is refused before the model call. Move the retake check forward in B3. Do not weaken the decision.

### P2 — Six letters never receive the archetype sentence

`letterLoadContext` returns `profile: null`. The letter is complete without the sentence. B2 may load one short name from a verified record.

### P2 — A changed login email is not the send address

The cron uses `state.email`. B2 may resolve the current confirmed auth email at send time.

### P2 — Free Nest copy and the two next-step labels

Production still omits My Journey and uses one name for two lists. B1 is written on this branch and is not deployed.

### P2 — Account closure is undocumented as a member path and incomplete as a delete

Cascades cover reflections, letter state, entitlements, and links. They do not cover delivery rows, `nest_owner_emails`, or KV. The plan is in B4. No delete button is added.

### P3

- Reflection cards show a date without a time.
- The full letter set has not been opened in a phone mail client.
- One live coaching note per tool has not been read.
- `docs/NEST-LETTERS.md` still describes `v8.4.0` and says the last-run key is not written. Update that note with B2, not by changing send behavior.

## Release B

Release B finishes the existing Nest. It does not add an assessment, a tool, a price, or a subscription tier. It does not weaken Release A.

B1 is in this working tree and is not deployed. B2, B3, and B4 are not implemented.

### B1 — Product polish

Small. Pages only. No migration. No worker. No mail.

- Free Nest, on the signup card and on the signed-in plan note, names My Journey, the Glow Map, quizzes, and the First Flight workbook. Coaching notes are only if the member asked. Nest Plus is described as what Plus adds.
- The sidebar checklist is “For your Nest.” It is the product list: Compass, bookings, Intensive tasks, and the photo.
- Saved exercise steps are “Steps you saved.”
- After a coaching note exists, the page says a new perspective changes that note, saved reflections stay saved, and saving this note adds another entry.
- `nest-client.js` is `?v=56` and `journey.js` is `?v=8` so a cached copy cannot keep the old sentences.

Review this diff before any Pages deploy. After a reviewed deploy, confirm https://lilbird.life/nest/ serves `v=56` and the new free-plan sentence. Do not deploy the worker with B1.

### B2 — Email reliability

Not started. Small worker change after review. One deploy, with `--keep-vars`, `NEST_LETTERS_MODE=general`, `NEST_LETTERS_ENABLED` left true, and the cron left at `0 15 * * *`. Do not trigger the cron. Confirm deliveries stay 5 and letter states stay 3 immediately after deploy.

#### Archetype sentence

`letterLoadContext` loads the auth user for the greeting and then sets `profile: null`. `compassLine` already refuses anything that is not a short plain name.

Load a profile only for the member whose letter is being sent. Use the same ownership decision as a canvas read: a verified link, a `nest_reads` row, or a stored email that matches that member’s confirmed auth email. Read the name from that member’s own KV record. Pass only the object `archetypeName` already accepts. Do not put scores, history, or another member’s record into the letter context. If the name is missing, long, numeric, or clinical, `compassLine` already returns an empty string and the letter stays as written.

#### Verified email

Enrollment already refuses an unverified address. The send path does not look again.

At send time, read the auth user that `letterLoadContext` already fetches. Use `user.email` only when `email_confirmed_at` or `confirmed_at` is set. Ignore `email_change` and any address from the request. If the confirmed address differs from `state.email`, send to the confirmed address and update that one field on the same `user_id`. Do not insert a second state row. Do not change `nest_coaching`, `product_coaching`, `step`, `phase`, `welcome_sent`, or `next_at`. Do not mark old deliveries sent and do not claim them again.

Suppression stays. Check `unsub:{hash}` for the stored address and for the confirmed address. A suppression on either one skips the send. The unsubscribe token stays bound to the user id, so the link in the new message still turns this member off.

#### The 27 October n01

Read-only, 30 October:

| Fact | Value |
| --- | --- |
| Letter | `n01` |
| Status | `failed` |
| Claimed | 2026-10-27 |
| Sent at | empty |
| Member coaching | off |
| Sequence status | `unsubscribed` |
| Next send | empty, so the row is not due |

The table has no provider-error column. `markFailed` stores only `status = failed`. The Resend body was not kept. The 27 October audit called it a rejected test send. Worker logs from that day were not opened, because a log line can contain an address. The reason stored in the database is the status itself.

Why it will not move by itself:

- `dueStates` requires coaching on and a due `next_at`. This member has neither.
- `claim` holds a row whose `first_claimed_at` is older than 24 hours. It does not send that row again.

Do not retry it. Do not mark it sent. Marking it sent would advance a member who is unsubscribed and who may never have received it.

Safe handling:

- Leave this row failed.
- After 31 October 15:00 UTC, read `nest-letters:last-run`. It should show counts only. A missing key means that cron did not finish a send pass.
- Keep using the count query in `docs/NEST-LETTERS.md`. Do not add the address to that query.
- A later, reviewed change may store a short provider status code on failure. It must not store the letter body or the address. That column is not part of B1, and it should not be migrated until B2 is reviewed.
- An alert that fires when `failed`, `held`, or `uncertain` is greater than zero is worth adding only after one real last-run report has been seen. The alert body should be counts, not an address.

### B3 — Ownership and the paid retake

Not started. Do not deploy until the trust model and the tests have been reviewed.

#### Trust model

Release A is the floor.

| Proof | May open this member’s canvas | May write `nest_owner_emails` or grant a new Inner Compass |
| --- | --- | --- |
| Verified link (`capability`, `read`, `owner_email`) | Yes | Yes |
| `nest_reads` for this account and this nest | Yes | Yes |
| Confirmed auth email matches the email already stored on the read | Yes | No. The stored email could have been written before the patch. |
| Legacy link, null proof | No. Recovery copy, no stored email in the body | No |
| Nest id, launch token, Nest Plus, or a typed email | No | No |
| Unexpired capability, signed out, bound to this read | Yes, for two hours | Yes, for the browser that created the read |

What a legitimate member feels today: if they sign in with the address on the results email, the canvas opens. The Nest claim still refuses, because there is no `nest_owner_emails` row. A legacy link does not become trusted. Existing entitlements stay.

Proposed recovery, not built:

1. The member is signed in and presents a nest id or a results link.
2. If `decideCanvasAccess` allows them because the confirmed session email matches the stored email, the worker may send one confirmation to that stored address. The member does not type the address. A non-match gets the current recovery sentence and no send. The response never includes the stored address.
3. The message carries a single-use token bound to that user id and that nest id, with a short expiry.
4. The same signed-in user presents the token. The worker inserts one `nest_owner_emails` row for that nest and that confirmed email. The existing claim function then grants Inner Compass. It still refuses everyone else.
5. A legacy link is unchanged until that confirmation succeeds. Other entitlements are not updated. No row is deactivated.

Security implications:

- Inbox control of the address already on the read, plus a confirmed login for that same address, is the new proof. A typed email is not.
- A nest id is not proof, and a legacy link is not proof.
- The residual risk is historical. If a stored email was forged before Release A, a confirmation to that address confirms the forger. Do not backfill `nest_owner_emails` from email match alone. That would weaken Release A.
- Rate-limit the confirmation. A refusal stays free of profile fields.
- Tests to add before any deploy: typed email ignored, nest id alone refused, token for another user refused, expired token refused, one owner row written for the matching account, other entitlements untouched, legacy link still refused until the token succeeds, and the current canvas-access tests still pass.

The early retake check is the other half of B3. In `handleAnalyze`, when `retakeOf` is set, call `inheritPaidRetake` before the Anthropic request. An unauthorized retake returns the current denial and does not save. An authorized retake still copies paid status and still saves. A nest id that already has a record keeps the access check it has now, which already runs before the model call. The 409 for an existing profile can stay as it is: it returns no profile body. Do not move that into a read of the profile.

### B4 — Account closure and retention

The member request is on `feature/nest-release-b4` and is not deployed. It is a written request to hello@lilbird.life. It does not delete an account. The staff procedure is `docs/NEST-ACCOUNT-CLOSURE.md`. No script deletes users.

#### What happens today

The Nest settings page now explains closure and asks the member to write to hello@lilbird.life. That page does not delete the account. `account_closes` is still a staff table with no member policy. Deleting `auth.users` by hand is not a complete erasure. The steps are in `docs/NEST-ACCOUNT-CLOSURE.md`.

#### What cascades from `auth.users`

Production foreign keys with `ON DELETE CASCADE`, read 30 October:

- `journey_reflections.user_id`
- `nest_letter_state.user_id`
- `nest_reads.user_id`
- `deep_profile_links.user_id`
- `deep_profile_launches.user_id`
- `user_entitlements.user_id`
- `intensive_enrolments.user_id`
- `lci_sessions.user_id`
- `live_roster.user_id`
- `course_users.id`
- `account_merge_tokens.keeper_user_id`

Deleting the auth user therefore removes that member’s reflections, letter schedule, reads, links, launches, entitlements, Intensive rows, live roster row, course user row, and merge tokens.

#### What does not follow

- `nest_letter_deliveries` has `user_id` and no foreign key. The row would remain: delivery id, letter key, status, and timestamps. It does not store the address. It is an orphan operational record.
- `nest_owner_emails` is keyed by nest and email, not by user id. It would remain.
- Cloudflare KV `NEST_PROFILES` is not in Postgres. Assessment records live about one year (`expirationTtl` 31536000) under the nest id and can contain the profile, the email, and Life Canvas. `unsub:{hash}` and `seq:{hash}` are keyed by email hash. `bridge:couple:{id}` and `bridge:code:{code}` hold relationship data. None of these delete with the auth user.
- Stripe is outside this database. A cascade of `user_entitlements` does not cancel a subscription. Invoices live at Stripe.
- Supabase has no project backup on this plan, so a database delete is not recoverable from Supabase. KV has no backup that this refresh found. A delete should be treated as final for the rows it actually removes.

#### What to delete, what to keep, what to handle specially

Delete with the auth user, once a reviewed flow exists: the auth user, sessions, identities, the cascaded rows above, and then the KV records that this member can be shown to own. Ownership for a KV assessment is the same Release A decision. Do not delete a nest record because a requester knows the id.

Handle specially before the auth delete:

- Cancel the Stripe subscription first, or the member keeps paying after the Nest is gone. Keep Stripe invoices for tax and accounting. Do not depend on `user_entitlements` as the invoice record.
- Export or retain delivery rows that are needed to show what was sent and when. They can be reduced to letter key, status, and time, with the user id removed, if a dispute or an unsubscribe complaint still needs them. Do not keep the address on that reduced row.
- Keep a suppression for the confirmed email hash so a later signup with the same address does not silently opt back in. That hash is not the address. Say this in the confirmation.
- Bridge: delete a couple record only when every participant has closed, or remove this member’s profile and secret and leave the other participant’s half. Do not delete the other person’s assessment.
- `nest_owner_emails`: delete the row only when it matches an assessment this member verifiably owns.

Retain:

- Stripe invoices and the minimum tax record Stripe already holds.
- A staff note that a closure was requested and completed, without the profile or the letter body. `account_closes` can hold that if its columns are limited to time, status, and a staff actor.
- Anonymous counts. Not the member’s answers.

There is no member confirmation today because there is no member action. A future flow should send one message to the confirmed email after the delete succeeds, saying the Nest login is closed and naming what remains (Stripe invoices, the email-hash suppression). If the delete fails partway, send nothing that claims the data is gone. KV deletes should be in the same reviewed procedure, or the confirmation must say the assessment copy expires on its existing one-year timer and has not yet been removed.

The first implementation is the staff checklist and a settings request. The browser does not call `auth.admin.deleteUser`.

### Dependencies

- B1 depends on nothing in B2–B4. It is Pages only.
- B2 depends on the live gate staying `general` and enabled. A deploy without `--keep-vars` can drop plain variables, including the mode.
- B3 depends on Release A staying as it is. The confirmation token is an addition. Email match must not start writing `nest_owner_emails` by itself.
- The retake reorder depends on `inheritPaidRetake` staying the same decision. Only its position in `handleAnalyze` changes.
- B4 depends on a backup decision, a Stripe cancellation step, and a KV ownership check. It should follow B3 so ownership is understood before records are deleted.
- Local `main` at `443b8baf` still has the unpublished Inner Compass claim. Do not merge it.

### Deployment sequence

1. Review B1. Deploy Pages only. Verify the live sentences and `v=56` / `v=8`. Leave the worker on `v8.5.2-release-a`.
2. Review B2. Deploy the assessment worker with the mode and the flag preserved. Do not trigger the cron. Read counts before and after. Read `nest-letters:last-run` only after the next scheduled run.
3. Review the B3 trust model and its tests. Then deploy that worker. Test with disposable accounts. Remove them. Do not use a real member’s read.
4. Accept or revise the B4 plan. Only then write a staff checklist. A member button waits until that checklist has been used on a disposable account and the KV and Stripe steps are real.

### Complexity

| Stream | Size | Deploy |
| --- | --- | --- |
| B1 copy and labels | Small. Done on this branch. Tests included. | Pages, after review |
| B2 archetype and confirmed email | Small. One worker function and send path. Tests for a missing name, a long name, an unverified change, and an unchanged sequence. | Worker, after review |
| B2 failure visibility | Small as an operator step: read the key after 31 October. A status-code column or an alert is a separate reviewed change. | None for the read. Worker only if a later alert is approved |
| B3 recovery token | Medium. New token, rate limit, one owner-email insert, tests, security review. | Worker, after that review |
| B3 retake order | Small. Move one call above the model request. Existing refusal tests stay. | Can ship with the B3 worker |
| B4 deletion | Medium to large, and destructive. Not sized for this branch. | None until the plan is accepted |

## Tool inventory

Unchanged. Fifteen tools, version 1, each ending in a next step, each at `https://lilbird.life/nest/?tool=<id>`.

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

## Letter sequence

Unchanged. Welcome, letters 1–26, then four Life Canvas check-ins. Tool links use the live Nest deep link. Those tools are available to any signed-in Nest member.

Letters 4, 8, 13, 18, 23, and 26 may add one archetype sentence. Production does not load the name, so those letters go out without it.

## Release A status

Deployed 30 October 2026. Pages `3a3aef12`. Worker `v8.5.2-release-a`, deployment `e5ba2a17-553e-4d1a-b4f3-bec81bbb4163`. `NEST_LETTERS_MODE=general`. The hotfix is applied. Disposable proof rows from the deploy check were removed. The notes below were written on 28 October, before that deploy. Where they say the patch is not deployed, that was true on that date.

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
