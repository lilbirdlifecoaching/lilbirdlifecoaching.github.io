# Worker patch: align `userHasSoloAccess` with Nest + Solo UI

**Do not deploy until approved.** GitHub Pages merge does **not** update Cloudflare `worker-solo`.

| | |
|--|--|
| Canonical source | iCloud `…/Lil' Bird/lilbird site/solo/worker-solo.js` |
| Live (pre-deploy) | `v1.32-nest-plus-grant` — Solo only via `solo_course` **or** `purchased_at` |
| Ready to deploy | `v1.33-solo-access-align` — also grants for active `nest_premium` |
| Wrangler | same folder `wrangler.toml` (`name = "worker-solo"`) |

## Authoritative rule (same as `js/lilbird-solo-access.js`)

Grant Solo chat / video / summarise / session-email / notify-illustrator when **any** of:

1. `user_entitlements` row: `product = 'solo_course'` and `active = true`
2. `user_entitlements` row: `product = 'nest_premium'` and `active = true`
3. `course_users.purchased_at` is non-null for that user id

Deny: Free Nest, Nest Plus only, missing/revoked entitlements, no purchase row.

## Implemented change (already applied in iCloud source — not live yet)

```js
async function userHasSoloAccess(userId, env) {
  // Align with js/lilbird-solo-access.js: solo_course | nest_premium | purchased_at.
  // Free Nest and Nest Plus alone do not grant Solo Course access.
  if (!isUuid(userId)) return false;
  const headers = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
  const [entRes, cuRes] = await Promise.all([
    fetch(`${env.SUPABASE_URL}/rest/v1/user_entitlements?user_id=eq.${userId}&active=eq.true&product=in.(solo_course,nest_premium)&select=product&limit=1`, { headers }),
    fetch(`${env.SUPABASE_URL}/rest/v1/course_users?id=eq.${userId}&purchased_at=not.is.null&select=id&limit=1`, { headers }),
  ]);
  const ent = entRes.ok ? await entRes.json() : [];
  const cu = cuRes.ok ? await cuRes.json() : [];
  return (Array.isArray(ent) && ent.length > 0) || (Array.isArray(cu) && cu.length > 0);
}
```

`WORKER_VERSION` → `v1.33-solo-access-align`.

Protected routes unchanged (still call `userHasSoloAccess`):

- `POST /chat`, `/summarise`, `/session-email`, `/solo-video-url`
- `POST /notify-illustrator`

Nest-only routes (`/nest-welcome-email`, Nest Plus billing, etc.) are not loosened.

## Purchase / revocation semantics (DB facts — no schema change)

| Situation | How it is represented today |
|-----------|-----------------------------|
| One-time Solo purchase | Stripe webhook sets `course_users.purchased_at` **and** grants `solo_course` (`granted_by: stripe`) |
| Purchase vs Premium expiry | `purchased_at` is independent of Nest subscriptions → one-time purchase **survives** Premium expiry if the row is left intact |
| Expired Premium | `nest_premium` entitlement missing or `active = false` (no expiry column) |
| Explicit revoke | Set entitlement `active = false`; optionally clear `purchased_at` |
| Refund | **No** `refunded_at` / status column on `course_users`. Refund is not distinguishable from a valid purchase unless staff clear `purchased_at` and deactivate `solo_course` |
| Conflicting rows | Any remaining valid grant wins (purchase **or** active solo/premium) |

Do not invent new entitlement products or rewrite production rows without approval.

## Deploy (after approval)

From the iCloud `solo/` folder (where `wrangler.toml` + patched `worker-solo.js` live):

```bash
# 1. Confirm patch locally
rg "v1.33-solo-access-align" worker-solo.js
rg "product=in.(solo_course,nest_premium)" worker-solo.js

# 2. Deploy
wrangler deploy

# 3. Confirm
curl -sS https://worker-solo.cwwq46sn7m.workers.dev/ping
# expect: {"ok":true,"version":"v1.33-solo-access-align"}
```

Then merge the frontend PR so GitHub Pages publishes Nest/Solo UI that uses the same policy.

## Rollback

Redeploy the previous Worker version (`v1.32-nest-plus-grant`) from Cloudflare dashboard **Workers → worker-solo → Deployments → Rollback**, or `wrangler rollback` / re-upload the prior script.

Pages may stay on the new UI: Nest/Solo already deny Nest Plus; a rolled-back Worker is **stricter** (Premium-only owners lose API access again) — safer than a looser Worker.

## Stripe sync (unchanged)

On Solo Checkout `checkout.session.completed`, Worker continues to:

- upsert `course_users` with `purchased_at`
- grant `user_entitlements.solo_course` (`granted_by: stripe`)
- initialise `session_progress`

Guest purchase → set-password Nest flow is unchanged.

## Release order

1. Verify Worker implementation (this patch + `solo/worker-solo-access-align.test.mjs`).
2. Deploy compatible Worker (`v1.33-solo-access-align`).
3. Confirm existing Solo purchases and any Premium entitlements work (`/ping` + signed-in chat/video).
4. Merge frontend PR → GitHub Pages.
5. Test complete signed-in Nest → Solo experience (including mobile Session Info).
