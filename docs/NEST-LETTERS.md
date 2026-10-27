# Nest letters

Status: built on `feature/nest-letters` from published main `b68433f`. Not merged. Not deployed. Scheduled sends are off. Existing members are not enrolled. Local `main` still holds the unpublished Inner Compass claim and is not in this branch.

## What already exists

Nest signup creates a Supabase account in `nest/nest-client.js`. It does not enroll anyone in an email sequence, and it does not call Beehiiv. The confirmation message is a Supabase auth email. `/nest-welcome-email` on the Solo worker can send "Your Nest is ready" through Resend, and nothing in the Nest page calls it.

Beehiiv stays a separate list. The homepage embed, the Inner Compass checkbox, the Glow Map checkbox, the readiness quiz, and the signed `/newsletter` link are unchanged.

The assessment worker (`lilbird-assessment`) sends the ten welcome emails on days 1, 2, 4, 6, 8, 10, 13, 16, 20, and 24. A daily cron at 15:00 UTC calls Resend's batch API. Day 24 says, "From here, you'll only hear from me if you want to." People join that series when an Inner Compass read is emailed, not when a Nest is created.

The same worker sends product and season follow-ups from keys named `flow:ff`, `flow:coaching`, `flow:solo`, `flow:abandoned`, `flow:quiz`, `flow:glow`, and `flow:checkin`. The Solo worker writes `buyer:{hash}` on a First Flight, coaching session, Solo course, or Intensive, marks the ten-email series finished, and ends those flows. Nest Plus, a paid Inner Compass read, and the workbook do not do that.

Both workers share the `NEST_PROFILES` KV namespace. Unsubscribe is `unsub:{sha256(email)}`, written by `POST /unsubscribe` on the assessment worker. That global flag stops the ten emails and the follow-up flows. It does not change a Beehiiv subscription.

Life Canvas already opens from `?tab=canvas`. A tool link `?tool=<id>` already skips the automatic welcome tour.

## What this branch adds

Three tracks:

- Track A, Nest membership. A welcome note, 26 fortnightly letters, then a Life Canvas check-in about every 90 days. A purchase does not read or write this track.
- Track B, product support. The existing First Flight, coaching, Solo, Intensive, quiz, Glow Map, and checkout flows stay where they are.
- Track C, the Beehiiv newsletter. No new subscribe or unsubscribe call.

Track A is stored per Nest account in Postgres, proposed in `nest/nest-letters.sql`. Do not apply that file until a release is approved. KV cannot lock two cron runs: both can read the same key before either write lands. The SQL adds a conditional lock and a unique delivery id so a letter cannot be claimed twice, and the step moves only after the send is recorded.

`runNestLetterCron` returns `{ skipped: 'disabled' }` unless `NEST_LETTERS_ENABLED` is exactly `true`. This branch does not set that variable and does not deploy the worker.

## Enrollment

Signup explains the notes and includes a checkbox, ticked by default, that is not required to create a Nest. The choice is stored in the browser under the new account id. The server accepts it only from a verified signed-in member, and it refuses a body that tries to name some other email.

Existing members see an invitation. Nobody is enrolled by this branch going live. If they finished the day-24 note, or they already unsubscribed, the invitation says so and asks for a fresh yes. Turning the notes back on does not restart a sequence that already has progress.

Someone still inside the ten-email series waits until 14 days after that series' day 24, counted from their own enrollment time. Everyone else waits a short introductory delay, two days unless the schedule is changed. Letters then go every 14 days. After letter 26, check-ins go about every 90 days. A failed send keeps the same letter and retries later.

If another nonessential email is already due the same day, the Nest letter waits until the next day. It does not skip its number. Product notes with a time attached keep their own schedule.

## Letters and tools

The 26 letters are in `nest/nest-letters-copy.js`. Each one links to a live tool at `https://lilbird.life/nest/?tool=<id>`.

| Letter | Tool |
| --- | --- |
| 1 When the day has no edges | energy-inventory |
| 2 A no that still leaves the relationship standing | boundary-untangler |
| 3 When the sentence lands somewhere else | communication-reset |
| 4 The race you did not enter | transition-map |
| 5 The quiet that is not peace | communication-reset |
| 6 The people who leave you smaller | connection-check |
| 7 Wanting, before you can name it | decision-clarity |
| 8 The yes you did not mean | expectations-audit |
| 9 When care starts to feel like a test | family-expectations |
| 10 When two people share a room and miss each other | connection-check |
| 11 The work that ate the evening | workload-reset |
| 12 The plan that did not happen | shadows-sparks |
| 13 The door you keep circling | courage-compass |
| 14 What was never only yours | responsibility-inventory |
| 15 The difference between rest and leaving | rest-or-escape |
| 16 When your effort goes unseen | identity-reflection |
| 17 The conversation you keep postponing | communication-reset |
| 18 Confidence is a small return | courage-compass |
| 19 The story your family tells about you | family-expectations |
| 20 Standing in the fog | transition-map |
| 21 Choosing without a perfect map | decision-clarity |
| 22 When a friendship changes shape | connection-check |
| 23 Coming back to your own name | identity-reflection |
| 24 The heat under the politeness | boundary-untangler |
| 25 A beginning that does not erase the last one | rhythm-reset |
| 26 A year, seen from here | shadows-sparks |

Letters 4, 8, 13, 18, 23, and 26 may add one sentence when the linked Inner Compass has a short archetype name. Scores, attachment, and private Journey answers are not read. If the name is missing or looks like a paragraph, the standard letter goes out.

The sender is `lil' bird <hello@lilbird.life>`. The signature is Luke & the lil' bird team.

## Preferences

Inside the Nest, a member can turn Nest coaching notes on or off, and product notes on or off. The newsletter section links to Beehiiv and does not change that subscription. A coaching unsubscribe link stops Nest notes and quarterly check-ins. It does not by itself turn off product notes. The older global unsubscribe still stops both.

## Safe release, when you ask for it

1. Apply `nest/nest-letters.sql` in the Supabase project. Do not run it before then.
2. Copy `nest-letters-copy.js`, `nest-letters.js`, `nest-letters-delivery.js`, and `nest-letters-worker.js` beside `lilbird-assessment.js`.
3. In that worker only, route `/nest-letters/preference` and `/nest-letters/unsubscribe` through `routeNestLetters`, with `getUser: letterUserFromRequest` and `flags: letterFlags`. Use `createSupabaseLetterStore` as the store.
4. Call `runNestLetterCron` from the existing daily cron. Leave `NEST_LETTERS_ENABLED` unset. The cron will skip.
5. Publish the Nest pages. The invitation appears, and choices save, but no letter sends.
6. After a check with the review accounts, set `NEST_LETTERS_ENABLED` to `true`.

Do not add this cron to `worker-solo`. Do not enroll existing members by a backfill. Do not merge local `main`.

## Limits

The worker wiring is in the Pages repository so it can be reviewed. It is not copied into the live worker, and this branch does not deploy it.

`letters-preview.html` is an unindexed review page. It renders every note in the browser. It does not send mail.

A Nest-only unsubscribe does not remove the global `unsub:` key. A global unsubscribe still blocks Track A until the member gives a fresh yes, which clears that key for their address. Product notes then follow the product switch, which stays off unless they turn it on.

The ten-email series still stops when someone buys a session or a course. Track A does not.

Beehiiv welcome mail, where someone already opted in, can still arrive beside a Nest note. This branch does not try to coordinate Beehiiv's calendar.
