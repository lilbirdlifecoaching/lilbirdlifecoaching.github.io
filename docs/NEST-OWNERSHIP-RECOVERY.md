# Inner Compass ownership recovery

Prepared on `feature/nest-release-b3`. Not deployed. Production remains Worker `v8.6.0-release-b2` until this is reviewed.

## What is not the same thing

| Fact | What it proves |
| --- | --- |
| Knowing an assessment id | The id is `nest-` plus a random UUID from the browser. Possession of the link is not ownership. Release A refuses a read from the id alone. |
| Knowing the stored email | The address was typed by whoever held the creating-browser capability, then a results message was sent there. No confirmation click was stored. A matching string does not write `nest_owner_emails`. |
| Controlling that inbox | The recovery proof. A one-time link is mailed only to the address already stored, and only when it is also the confirmed email of the signed-in Nest. |
| A Nest login | The session. It does not identify an assessment. An unconfirmed login, and a pending `email_change`, are ignored. |
| Independently verified ownership | A verified link (`capability`, `read`, or `owner_email`), a `nest_reads` row for this account, or a `nest_owner_emails` row for this confirmed email. A legacy link, with a null proof, is none of these. |

## How a read is born

The browser creates the id. `/analyze` stores the profile and a two-hour capability token for that browser. The token can open the read while it is valid and the caller is signed out. It can also allow the first email to be saved. A different address never replaces an email already stored. A paid read keeps the buyer’s email.

The results link in the mail is `https://lilbird.life/inner-compass/?nest=…`. It does not carry the capability token. After the token expires, a signed-in member can open the read when their account email matches the stored email. That open is a read. It does not fill `nest_owner_emails`. The claim function `link_deep_profile_to_user` still refuses until that table has the caller’s confirmed email. The function is unchanged.

Production on 30 October 2026 had five legacy links and no `nest_owner_emails` rows. Those links are not upgraded by this change.

## Who can recover automatically

Automated recovery requires all of these:

1. The member is signed in, and `email_confirmed_at` or `confirmed_at` is set.
2. The assessment already has an email, and it is the same confirmed address.
3. No other account is already bound in `nest_owner_emails`.
4. The member opens the single-use link from that inbox within 30 minutes, while signed in as the same account.

The worker then inserts one `nest_owner_emails` row. The existing claim function grants Inner Compass and, only if this member’s own link row is the same assessment, fills a null proof with `owner_email`. Other members’ links are untouched. Other products are untouched.

## Who is asked to write in

Manual support, with no mail sent and no address shown:

- The assessment has no stored email.
- The Nest email is not confirmed.
- The confirmed Nest email differs from the stored email.
- `nest_owner_emails` already names a different account.

The page keeps the existing sentence: sign in with the email that received the read, or write hello@lilbird.life from that address.

## What the member does

1. Sign in to the Nest.
2. Open the results link.
3. If the read is not already verified for this account, choose “Send a confirmation.” The page sends the assessment id and the session. It does not send an email address.
4. Open the message that arrives at the stored address. The link is `https://lilbird.life/inner-compass/#recover=…`. The token is in the fragment, so it is not sent to the site host. The page removes it before analytics or other third-party requests. The link contains no assessment id and no email.
5. The signed-in page confirms the token, calls the existing claim function, and returns to the results.

The response is the same whether or not a message was sent, so a guessed id does not reveal the stored address. Three requests an hour are kept, per account and per assessment. A failed send deletes the token and writes no ownership row. An expired token is refused. A token opened by a different account is refused and left for the member who requested it.

Cloudflare KV has no atomic delete. Two confirmations that overlap can both read the token before either deletes it. Both requests still have to be the same signed-in user, the same assessment, and the same confirmed email. `nest_owner_emails.nest_id` is the primary key, and the insert uses `ignore-duplicates`. After the insert the worker reads the stored email and returns success only when it is the confirmed address. A second account cannot take the row.

The confirmation link keeps the token in the URL fragment. The results page removes that fragment before analytics, fonts, or other third-party requests. The value stays in page memory until the confirmation request, then it is dropped. It is not written to local storage, and the analytics cleaner also drops a `recover` parameter. The page referrer policy is `strict-origin-when-cross-origin`.

## Database

No migration. Tokens live in the existing KV namespace for 30 minutes. The only new row is one `nest_owner_emails` insert after a successful confirmation. Coaching letter tables are not read or written.

## Cost

Resend sends one short message per confirmation. No new subscription and no new monthly service.
