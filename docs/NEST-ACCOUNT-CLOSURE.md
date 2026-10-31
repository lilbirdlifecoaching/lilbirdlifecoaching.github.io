# Nest account closure

Staff-assisted closure for Lil’ Bird. This release adds the member request in Nest settings. It does not delete accounts, cancel subscriptions, or change production data.

Production this note was written against: Pages merge `64a8d9580e2f1d0f98a05bcc16f2c5e6f323b537`, assessment worker `v8.7.0-release-b3`, Supabase Free, coaching letters on. There is no Supabase project backup on this plan.

The member writes to hello@lilbird.life from the confirmed address on the Nest. Staff follow the checklist below. Do not use `POST /account-close` on worker-solo. That route still bans a login for a very long time, writes the address into `account_closes`, and leaves the assessment, the letters, and Stripe where they are.

## Member wording

Shown in Nest settings, and again from the account card. The control is labeled **Close my account**.

Closing your Nest is something we do with you. Opening this page does not delete anything.

Write to hello@lilbird.life from the email address on this Nest. We will check that it is you, then close the login with you.

- Coaching emails stop.
- Saved assessments, your Life Canvas, and My Journey reflections will no longer open.
- An active subscription has to be cancelled, so you are not charged for a Nest you cannot enter. We do that with you before the login is closed.
- Receipts and other records that have to be kept for accounting can stay.
- A backup, if one exists, can remain until that copy expires. This Nest does not keep an automatic database backup today.
- A shared Bridge stays for the other person. We remove your side only.

Mail and payment services keep their own copies. Those do not all disappear when the Nest login closes.

## Data inventory

Personal information here means a name, an email address, a photo, assessment or reflection text, a message, or a payment identifier that can be tied to a person. A user id alone is an identifier. An email hash is still tied to that address. Counts with no identifier are not personal information.

The cascade column is what production foreign keys did on 30 October 2026, plus the schema in this repository. Tables named only in the Solo architecture note were not in that cascade list. Confirm the live constraint before relying on it. A blocked delete means a child row is still there. Remove the eligible child, then try again. Do not force the delete.

| Location | What is stored | How it relates to the member | Personal | Auth delete removes it | Separate deletion | Retain | Can affect someone else |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `auth.users`, identities, sessions, refresh tokens | Login, confirmed email, password hash, confirmation timestamps | The account | Yes | This is the account | Sessions go with the user when the auth user is deleted | No, after billing is resolved | A merge inside its undo week can have banned the other login. Undo that merge first |
| `user_entitlements` | Product name, active flag, grant reason | `user_id`, cascade | The product can show what they bought | Yes | No | The purchase itself stays in Stripe | No |
| `course_users` | Email, name, Stripe customer id, childhood photo URL, illustration URL, optional nest id | `id` is the auth user, cascade | Yes | Yes, the row | The photo file in Storage stays | Stripe customer id is only a pointer. The Stripe customer stays | The photo URL may already have been sent to the illustrator |
| `session_progress` | Solo and First Flight session status and times. Session 0 is First Flight | `user_id` toward `course_users` in the Solo notes. Not in the 30 October auth cascade list | Progress, not the written answers | Only if the live foreign key cascades through `course_users` | Yes, if the delete is blocked or the row remains | No | No |
| `session_responses` | Written Solo answers | `user_id`. Not in the auth cascade list | Yes | Unknown until the constraint is checked | Yes, if it remains | No | No |
| `ai_memory` | Solo chat messages and a summary | `user_id`. Not in the auth cascade list | Yes | Unknown until the constraint is checked | Yes, if it remains | No | No |
| `tool_outputs` | Solo tool answers, including the childhood photo URL | `user_id`. Not in the auth cascade list | Yes | Unknown until the constraint is checked | Yes, if it remains | No | No |
| `full_flight_plan` | North star, commitments, named people, glow-map scores, plan PDF URL | `user_id`. Not in the auth cascade list | Yes | Unknown until the constraint is checked | Yes, if it remains | No | Named people are mentioned. The row is still this member’s |
| `email_log` | Solo mail type and time | `user_id`. Not in the auth cascade list | The type and time, tied to the user id | Unknown until the constraint is checked | Yes, if it remains | A send log can stay as an operational record. The address is not a column in the architecture note | No |
| `journey_reflections` | My Journey answers, insight, next step | `user_id`, cascade | Yes | Yes | No | No | No |
| `deep_profile_links` | One primary nest id and `ownership_proof` | `user_id`, cascade | The nest id is a capability handle | Yes | No | Leave other members’ rows, including the five legacy links | One row per user. Deleting this row does not delete the assessment |
| `nest_reads` | Extra nest ids for this account | `user_id`, cascade | Nest ids | Yes | No | No | No |
| `deep_profile_launches` | Course launch token, expiry, used time | `user_id`, cascade | A secret token | Yes | No | No | No |
| `nest_owner_emails` | Confirmed email bound to one nest id | Nest id and email. No user id | Yes | No | Yes. Delete the row only when this member verifiably owns that assessment | No | The primary key is one owner. A wrong delete lets another account claim that read |
| `intensive_enrolments` | Intensive enrolment and paid time | `user_id`, cascade | Paid time | Yes | No | The charge stays in Stripe | No |
| `lci_sessions` | Intensive session rows | `user_id`, cascade | Session progress | Yes | No | Booked time may also exist in the calendar tool | No |
| `live_roster` | Live attendance, email, note | `user_id`, cascade | Yes | Yes | No | No | The session itself is shared and stays |
| `nest_letter_state` | Confirmed email, coaching yes or no, sequence step, next send time | `user_id`, cascade | Yes | Yes. The schedule disappears, so stop mail before the delete | Set coaching off and `next_at` null first | The opt-out has to be kept another way, or a new signup on the same address can start again | No |
| `nest_letter_deliveries` | Delivery id, letter key, status, times. No address column | `user_id`, no foreign key | The user id | No. The row becomes an orphan | Optional. Leave it unless counsel says to remove the user id | Keep the letter key, status, and time. They show what was sent | No |
| `nest_letter_lock` | One cron lock | None | No | No | Do not touch it | Yes. It is the send lock | A change can affect the next send for everyone |
| `account_merge_tokens` | Other email, token hash, expiry | Keeper `user_id`, cascade | Yes | The keeper’s tokens | If this member is only the other party, leave the keeper’s token | No | Deleting the keeper’s pending token stops the other inbox’s confirmation |
| `account_merges` | Both user ids, the other email, a summary | No foreign key in `desk-and-merge.sql` | Yes | No | After the undo window, the row can be reduced | Inside seven days, undo first | The other login may have been banned by the merge |
| `account_closes` | User id and email, closed time | User id, no foreign key | Yes | No | Do not write this table for the completion note. It keeps the address and has no staff actor | A later reviewed note can store the date and a staff actor without the address | No |
| `desk_alerts` | Kind, email, user id, detail JSON | No foreign key | Yes, when an email or a trouble note is present | No | Delete rows for this user id only | A coaching-letter alert has counts and a null email. Leave those | A shared alert is not this member’s |
| `premium_waitlist` | Email and optional user id | Email is the key | Yes | No | Delete the row for this address | No | No |
| `staff_members` | Staff email | Staff | Yes, staff | No | Leave it | Yes | It is not a member row |
| Cloudflare KV `nest-…` | Inner Compass profile, stored email, Life Canvas scores and history, capability token | Nest id. Written only when this member verifiably owns that id | Yes | No | Yes. TTL is one year from the last write (`31536000` seconds), refreshed on save | No | A nest id the member does not own stays. Email match alone is not ownership for this delete |
| KV `ownrec:`, `ownrec-rate:`, `ownrec-nest:` | Recovery token hash, user id, nest id, expiry. No email in the token | The signed-in user and the nest id | The user id and nest id | No | Delete this user’s rate key and tokens for their nests. Tokens already expire in 30 minutes. Rate keys expire in one hour | No | A token only binds the user it names |
| KV `seq:{hash}` | Story-sequence state. Metadata holds the raw email, nest id, and archetype | Email hash | Yes | No | Delete it. It contains the address | No | No |
| KV `unsub:{hash}` | The time a marketing unsubscribe was stored. The value is a timestamp | Email hash | The hash can be linked back to the address | No | Leave it in place so the same address is not silently opted back in | Until counsel says the hash itself must go | No |
| KV `buyer:{hash}` | Marker set on a First Flight, coaching, Solo, or Intensive purchase | Email hash | The hash | No | Leave it. It keeps that address out of the sales story | Same question as the unsubscribe hash | No |
| KV `bridge:couple:{id}` | Both people’s names, nest ids, profile summaries, secrets, check-in text | Members inside one object | Yes | No | Remove this member’s half. Delete the couple object only when every participant has closed | The other half | Yes. The other person’s name, read, and check-ins are in the same object |
| KV `bridge:code:{code}` and `bridge:checkin:…` | Join code, weekly check-in | The couple | Yes | No | Remove this member’s check-in keys. Leave the code while the other person remains | The other half | Yes |
| KV `evt:` and `nest-letters:last-run` | Short analytics and the last cron counts | Not a member record | Counts | No | Do not use closure to delete these | Operational | The last-run key is shared |
| Supabase Storage `childhood-photos` | The uploaded picture, path `{userId}/photo-…` | The user id in the path. The bucket is public | Yes, a photo | No | Yes. Delete every object under that user id prefix. Clear `childhood_photo_url` before `course_users` goes | No | A URL already emailed to the illustrator can remain in that mailbox |
| Stripe customer, subscription, invoices | Customer, card, subscription status, invoices | `course_users.stripe_customer_id` and subscription metadata | Yes | No | Cancel an active subscription in Stripe. Do not delete the customer or the invoices from this procedure | Invoices and the tax record Stripe already holds, until an accountant or counsel sets the period | Cancelling the wrong customer charges or cuts off another person |
| Resend | Sent message content and recipient, on Resend’s side | The address that was mailed | Yes | No | There is no delete call in this release | Whatever Resend keeps. Read the current account terms. Do not guess a period | No |
| Coaching unsubscribe | `nest_letter_state.status = unsubscribed`, and the KV `unsub` hash checked at send time | The user, and the address hash | Yes | The state row goes away with the user | Write the KV hash and stop the schedule before the auth delete | The hash, so the opt-out survives the row | No |
| Beehiiv | Newsletter subscription, if they joined the list themselves | A separate signup. Nest registration does not add them | Yes | No | Ask them, and remove the list entry only if they ask | Their newsletter choice | No |
| Cal.com | First Flight, coaching, and Intensive booking details | The email they used to book | Yes | No | Cancel future sessions with them. Past bookings stay with the calendar | The booking record, until counsel sets a period | Another person’s booking stays |
| Browser | Theme in `localStorage`. Canvas capability in `sessionStorage` for a nest id | This browser only | The capability token | No | Cannot be cleared from the server | Until they close the tab or clear the site data | No |
| Analytics and worker logs | Page events. Recovery and nest tokens are stripped from the page URL before the tag runs | A browser, sometimes an address in a log line | It can | No | No switch in this release | The processor’s own period. Read the current terms | Logs can mention more than one request |

`link_deep_profile_to_user` is unchanged. Closure does not grant or revoke Inner Compass by itself. Entitlement rows disappear only when the auth user is actually deleted, which this release does not do.

## Retention

These periods are operational. They are not a legal opinion. Where a law or a tax rule may set a different period, that is marked for an accountant or counsel.

**While the account is open.** Keep the rows and the KV record the product uses. Recovery tokens last 30 minutes. Recovery rate keys last one hour. The assessment KV entry lasts one year from the last save and is refreshed when the read is saved. The canvas capability lasts two hours. A Bridge join code lasts seven days (`604800` seconds). The couple object uses the same one-year KV lifetime as an assessment.

**At closure, once staff have finished the checklist.** Remove the auth user and the rows that cascade from it. Remove eligible Solo answer tables that do not cascade. Remove the member’s half of a Bridge. Remove the KV assessment they verifiably own. Remove `seq:{hash}` because its metadata contains the address. Remove the childhood photo object. Remove this member’s `desk_alerts` and waitlist row. Stop coaching mail before the user delete.

**Kept for an operational reason, with no statutory period invented here.** `nest_letter_deliveries` can stay as letter key, status, and time. `unsub:{hash}` and `buyer:{hash}` stay so the same address is not put back into marketing. `account_closes` is not the completion record, because it stores the email. A staff note of the date, and that closure finished, is enough. Do not copy answers into that note.

**Kept until an accountant or counsel says otherwise.** Stripe customers and invoices. Resend’s copy of sent mail. Calendar bookings. Beehiiv, if they are on that list. Analytics and host logs. A photo already forwarded to the illustrator, in that mailbox.

**Backups and exports.** Supabase Free has no project backup. A database delete is final for the rows it removes. KV has no separate backup in this design. The one-year key lifetime is an expiry, not a restorable backup. A member download from **Download my Nest** is a file on their own device. GitHub, staff inboxes, and any export someone saved are copies this procedure does not reach. Say that in the confirmation. Do not promise those copies are gone.

**Third-party processors.** Stripe, Resend, Supabase, Cloudflare, Google Analytics, Beehiiv, and Cal.com keep data under their own terms. This release adds no new processor and no new paid plan.

## Staff checklist

Do this for one requester at a time. Use a disposable account if you are practising. Do not practise on a member assessment.

1. **Verify the person.** The message comes from the confirmed address on the Nest. A message from another address gets a reply asking them to write again from the Nest address. Do not close from a nest id alone.
2. **Find the auth user.** In Supabase Auth, match that confirmed email to one user id. If two logins exist, stop and sort out the merge before closing either.
3. **List their assessments.** Read `deep_profile_links` and `nest_reads` for that user id. For each nest id, decide ownership the same way Release A does: a verified link (`capability`, `read`, or `owner_email`), a `nest_reads` row, or a `nest_owner_emails` row for their confirmed email. A legacy null proof is not enough. A typed email on the KV record is not enough to delete that record.
4. **Find Bridge records.** List KV keys `bridge:couple:` and read each couple. If a member row has this user id or one of their owned nest ids, that couple includes them. Leave every other couple untouched.
5. **Find coaching state.** Read `nest_letter_state` for this user id and `nest_letter_deliveries` for the same id. Note the step and whether coaching is on. Do not print the letter body into the staff note.
6. **Find Stripe.** Read `course_users.stripe_customer_id` for this user. In Stripe, open that customer. Look for a subscription that is active, past due, or trialing, including Nest Plus.
7. **Resolve billing.** Cancel the subscription in Stripe so it does not renew. Tell them the date the paid period ends if Stripe shows one. Leave the customer and the invoices in Stripe. Do not delete them as part of closure.
8. **Stop coaching mail.** On `nest_letter_state`, set coaching off, status `unsubscribed`, and `next_at` null. Write KV `unsub:{sha256 of the confirmed email}` if it is missing, with the current time as the value. Delete `seq:{hash}` so the story sequence metadata, which contains the raw address, is gone. Leave `buyer:{hash}` in place. Do not trigger the coaching cron. Do not change any other member’s sequence. The failed 27 October `n01` is not this task.
9. **Remove eligible personal data.** Delete Solo rows that do not cascade: `session_responses`, `ai_memory`, `tool_outputs`, `full_flight_plan`, and `session_progress` if they are still present after you know the constraint. Delete `journey_reflections` only if the auth delete will not cascade them. Delete this user’s `desk_alerts` and their `premium_waitlist` row. Delete `nest_owner_emails` only for a nest they verifiably own. On a Bridge couple, remove this member’s name, secret, profile summary, nest id, and check-ins. If the other person is still present, save the couple back. Delete the couple object and its code only when no other participant remains. Do not delete the other person’s `nest-` record.
10. **Remove their KV assessments.** Delete each `nest-` key from step 3 that they verifiably own. Delete `ownrec-rate:{userId}` and any `ownrec:` value whose nest id is one of those. Delete Storage objects in `childhood-photos` under `{userId}/`.
11. **Storage check.** After the prefix delete, the public photo URL should 404. If `course_users.childhood_photo_url` or `illustration_url` pointed somewhere else, open that URL and remove the object if it is in this project. An illustrator inbox is outside this project. Say so in the confirmation.
12. **Keep the financial record.** Stripe customer and invoices stay. `nest_letter_deliveries` stay. Do not put assessment answers into either.
13. **Delete the auth user last.** In the Supabase Auth admin, delete that one user. Cascades then remove reflections, letter state, reads, the primary link, launches, entitlements, Intensive rows, the live roster row, `course_users`, and the keeper’s merge tokens. If the delete is rejected, a child foreign key is still there. Remove that eligible child and retry. Do not delete a different user.
14. **Record completion.** Write the date and that the closure finished. Do not write the assessment, the letter body, or the address into `account_closes`. Do not call worker-solo `/account-close`.
15. **Confirm to them.** Send one message to the confirmed address after the auth user is gone and their owned KV keys are gone. Say the login is closed, coaching mail has stopped, subscriptions were cancelled, Stripe receipts remain, an email-hash opt-out remains so they are not silently resubscribed, and any backup or third-party copy can remain until that service drops it. If a step failed, do not say the data is gone. Name the part that is still there.
16. **Check the result.** The auth user is gone. Their coaching `next_at` is gone with the state row. A profile request for their former nest id does not return the read. The other Bridge participant’s nest id still loads for that participant. Legacy links that were not theirs are still five, or still the same rows as before this one closure. No coaching send was triggered by the closure.

## What this release changes in the product

Nest settings, reached from the picture button or from `#close-account`, shows the wording above and a mailto link. The account card’s **Close my account** button opens that section. It does not post to `/account-close`.

Coaching preferences, Journey, subscriptions, Release A, and B3 recovery are unchanged.

## Legal and accounting questions

These need a person who can advise Lil’ Bird. This note does not answer them.

- How long Stripe invoices and the customer record must be kept for tax.
- Whether a delivery log with a user id is a business record after the account is gone.
- Whether an email hash kept to honor an unsubscribe is still personal data that an erasure request can require you to delete, and how to honor the opt-out if the hash is deleted.
- How long Resend, Cloudflare, Supabase, Google Analytics, Beehiiv, and Cal.com keep their copies, under the contracts on this account.
- Whether a childhood photo already sent to an illustrator has to be recalled.
- What to say if a member asks for erasure of a shared Bridge check-in that also describes the other person.
