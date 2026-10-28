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

Track A is stored per Nest account in Postgres. `nest/nest-letters.sql` was applied in production on 26 Oct 2026. Do not run that file again. KV cannot lock two cron runs: both can read the same key before either write lands. The SQL adds a conditional lock and a unique delivery id. Two runs cannot both insert that id. The sequence step moves only after the send is recorded as sent.

If Resend accepts the message and the Worker stops before that record is saved, the step stays where it was. The next attempt uses the same delivery id as the `Idempotency-Key` on `POST https://api.resend.com/emails`. That header is documented for this endpoint. Keys expire after 24 hours and may be at most 256 characters. These letters are not sent through `/emails/batch`, because a batch uses one key for the whole request.

Resend returns the original acceptance only when the key and the JSON body both match. A repeated key with a different body returns `409 invalid_idempotent_request` and does not create a second email. The worker treats that response as the original send and records it, so the sequence can move on. A key that is already in flight returns `409 concurrent_idempotent_requests`. That stays uncertain, the step does not move, and the same key is used again later. A timeout, `429`, or `5xx` is also uncertain. A definite rejection can be retried with the same key.

If the success is still unrecorded after that 24-hour window, the letter is held and is not sent again by the cron. This is not exactly-once delivery. It is a single sequence step, with provider deduplication inside the window, and a stop rather than a blind resend after the window.

`runNestLetterCron` sends only when `NEST_LETTERS_ENABLED` is exactly `true` and `NEST_LETTERS_MODE` is exactly `test` or `general`. Setting the flag to `false` stops the next run immediately. An unset mode, or any other value, also sends nobody. `test` sends only to the ids in `NEST_LETTERS_ALLOWLIST`, and an empty list sends nobody. `general` sends to members who already opted in. A non-empty allowlist still limits a general run. An empty allowlist does not, by itself, turn delivery on.

The live worker at `v8.4.0-nest-live` is older than this rule. It treats a missing allowlist as general delivery while the flag is true. Do not deploy this file over that worker until `NEST_LETTERS_MODE` is set to `general` in the same change. Without that secret, the next cron would send nobody.

## Enrollment

Signup explains the notes and includes an optional checkbox that starts unticked. Leaving it unticked still creates the Nest. The choice is stored in the browser under the new account id. The server accepts it only from a verified signed-in member, and it refuses a body that tries to name some other email.

Existing members see an invitation. Nobody is enrolled by this branch going live. If they finished the day-24 note, or they already unsubscribed, the invitation says so and asks for a fresh yes. Turning the notes back on does not restart a sequence that already has progress.

Someone still inside the ten-email series waits until 14 days after that series' day 24, counted from their own enrollment time. Everyone else waits a short introductory delay, two days unless the schedule is changed. Letters then go every 14 days. After letter 26, check-ins go about every 90 days. A failed send keeps the same letter and retries later.

If another nonessential email is already due the same day, the Nest letter waits until the next day. It does not skip its number. Product notes with a time attached keep their own schedule.

## Letters and tools

The full wording for review, including subjects, preview text, tool links, and personalization placeholders, is in `docs/NEST-LETTER-REVIEW.md`.

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

## A held delivery

The cron never resends a letter whose first claim is older than 24 hours and whose row is still not `sent`. It also never resends a row left `uncertain` or `failed` on its own. Find the rows that need a person in the Supabase SQL editor. This list has the delivery id, the letter, and the status. It does not show the letter text, an email address, a user id, an archetype, or anything from My Journey.

```sql
select d.delivery_id,
       d.letter_key,
       d.status,
       d.first_claimed_at,
       d.uncertain_at,
       d.sent_at
from public.nest_letter_deliveries d
where d.status in ('claimed', 'uncertain', 'failed')
  and d.sent_at is null
order by d.first_claimed_at;
```

When you are ready to resolve one delivery, look up that single `delivery_id`. Do not export the whole member list.

`letter_key` is `welcome`, `n01` through `n26`, or a check-in such as `q0-0`.

To record that the member already received it, mark the row sent and wake the schedule. The next cron sees the sent row and moves the sequence once. It does not send again. Do not also change `step` by hand.

```sql
update public.nest_letter_deliveries
set status = 'sent', sent_at = now()
where delivery_id = 'PASTE THE DELIVERY ID'
  and sent_at is null;

update public.nest_letter_state
set next_at = now()
where user_id = 'PASTE THE USER ID'
  and next_at is null;
```

To send it again, first decide that a duplicate is acceptable. The first attempt may already be in the inbox, and Resend will not block a new send once the 24-hour key has expired. Only then reset the claim and wake the schedule. There is no automatic retry for a held row.

```sql
update public.nest_letter_deliveries
set status = 'released',
    first_claimed_at = now(),
    claimed_at = now()
where delivery_id = 'PASTE THE DELIVERY ID'
  and sent_at is null;

update public.nest_letter_state
set next_at = now()
where user_id = 'PASTE THE USER ID';
```

Do not run either update while this release is still unapproved, and do not run them against a real member until a letter has actually been held.

## How to review a delivery day

After 15:00 UTC, read the last run from the assessment worker's KV binding. The value is counts only.

```
wrangler kv key get --binding NEST_PROFILES "nest-letters:last-run"
```

`completed: true` means that cron finished a pass. `due` is how many letters were due. `accepted` is how many Resend accepted. `failed`, `held`, and `uncertain` are the ones that need a person. `finishedAt` before that day's 15:00 UTC means the cron did not write a new report.

The cron does not resend a held or uncertain letter. For a failed row, the existing retry schedule still applies inside the same delivery id. For a held row, use the update below only after you have decided what happened to that one delivery. Nothing in the report starts another send.

This report is written by the worker on this branch. The live `v8.4.0-nest-live` worker does not write it yet.

## Safe release, when you ask for it

The steps below are the original rollout. They are already done. The current gate is the mode section above. Do not deploy this branch's worker until `NEST_LETTERS_MODE=general` is set in the same change.

1. `nest/nest-letters.sql` is already applied. Do not run it again.
2. Copy `nest-letters-copy.js`, `nest-letters.js`, `nest-letters-delivery.js`, and `nest-letters-worker.js` beside `lilbird-assessment.js`.
3. In that worker only, route `/nest-letters/preference` and `/nest-letters/unsubscribe` through `routeNestLetters`, with `getUser: letterUserFromRequest` and `flags: letterFlags`. Use `createSupabaseLetterStore` as the store.
4. Call `runNestLetterCron` from the existing daily cron. Leave `NEST_LETTERS_ENABLED` unset. The cron will skip.
5. Publish the Nest pages. The invitation appears, and choices save, but no letter sends.
6. After a check with the review accounts, set `NEST_LETTERS_ENABLED` to `true`.

Do not add this cron to `worker-solo`. Do not enroll existing members by a backfill. Do not merge local `main`.

## Limits

The live sender is `v8.4.0-nest-live`. This branch prepares the next worker and does not deploy it.

`letters-preview.html` is an unindexed review page. It renders every note in the browser. It does not send mail.

A Nest-only unsubscribe does not remove the global `unsub:` key. A global unsubscribe still blocks Track A until the member gives a fresh yes, which clears that key for their address. Product notes then follow the product switch, which stays off unless they turn it on.

The ten-email series still stops when someone buys a session or a course. Track A does not.

Beehiiv welcome mail, where someone already opted in, can still arrive beside a Nest note. This branch does not try to coordinate Beehiiv's calendar.
