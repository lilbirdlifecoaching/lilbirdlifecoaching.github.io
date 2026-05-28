# Nest setup — start here when your brain is tired

This is the **only** doc you need to finish the Nest dashboard.  
Everything else can wait.

**Project:** `mebqqzbuwkogdxvnihrq`  
**Live URL (when deployed):** https://lilbird.life/nest/

---

## Where you are right now (honest snapshot)

| Step | What it is | Your status |
|------|------------|-------------|
| 1 | Supabase table for product access | **You said done** ✓ |
| 2 | Upload Nest files to lilbird.life | **You said done** ✓ |
| 3 | Open `/nest/` in browser | **Works** — you could log in ✓ |
| 4 | Unlock products for a test user | **Not done yet** — this is why cards stay locked |
| 5 | Welcome email | **Optional** — skip for now |
| 6 | Log out button + layout fixes | **In repo** — needs one more file upload |

**You are not behind.** You’re on step 4. Steps 5–6 are polish.

---

## The one idea to remember

**Nest login** = who you are (Supabase **Authentication → Users**).  
**Product cards unlocked** = separate rows in **`user_entitlements`** table.

Logging in does **not** auto-unlock products. You (or a script) must grant each product once.

Nest and Solo use the **same** Supabase login database, but **different** browser sessions. Same email/password can work in both.

---

## When you come back — do only these 3 things

### Thing 1 — Upload the latest Nest files (5 minutes)

Your live site may still have the **first** version (no Log out, layout quirks).

Upload these **4 files** from your computer to hosting, folder **`/nest/`**:

1. `nest/index.html`
2. `nest/nest-styles.css`
3. `nest/nest-client.js`
4. (optional) `nest/NEST-SETUP-GUIDE.md` — this file, for your reference

Then open https://lilbird.life/nest/ and hard-refresh: **Cmd + Shift + R**.

**Done when:** you see a **Log out** button top-right.

---

### Thing 2 — Create or find your test user (2 minutes)

1. Go to https://lilbird.life/nest/
2. **Create account** with an email you control (e.g. `hello@lilbird.life` or a personal test email).
3. In Supabase dashboard:
   - Correct project: URL must contain **`mebqqzbuwkogdxvnihrq`**
   - Go to **Authentication → Users** (not Table Editor → course_users)
4. Find that email and **copy the User UID** (long id like `a1b2c3d4-...`).

**Done when:** you have one user row and a copied UID.

---

### Thing 3 — Unlock products in Supabase UI (3 minutes, no Terminal)

1. Supabase → **Table Editor** → **`user_entitlements`**
2. Click **Insert row** (do this once per product you want unlocked).

Example — to test the dashboard nicely, add **three rows** (same `user_id` each time):

| user_id | product | granted_by | active |
|---------|---------|------------|--------|
| (paste UID) | `inner_compass` | `manual` | `true` |
| (paste UID) | `first_flight` | `manual` | `true` |
| (paste UID) | `solo_course` | `manual` | `true` |

Leave `id` and `granted_at` empty — they fill automatically.

3. Go back to https://lilbird.life/nest/ → refresh (or log out and in).

**Done when:** those product cards show **unlocked** (no “not yet unlocked” pill).

---

## Stop here — you’re live enough

After Things 1–3, Nest is **usable for real testing**.  
You do **not** need Terminal, admin script, or welcome email today.

---

## Optional later (not now)

### Welcome email (Step 5)
- Skipped until you want signup emails.
- Needs a small Cloudflare Worker endpoint + Resend key.
- Ask Cursor to wire it when you’re ready.

### Terminal grant script (alternative to Thing 3)
Only if you prefer command line:

```bash
cd "/Users/lukehaythorpe/Library/Mobile Documents/com~apple~CloudDocs/_LLC Buisiness Files/Lil' Bird/lilbird site"
export SUPABASE_URL="https://mebqqzbuwkogdxvnihrq.supabase.co"
export SUPABASE_SERVICE_KEY="paste_service_role_key_here"
node nest/admin-grant.js "your@email.com" first_flight
```

Requires **service_role** key from Supabase → Settings → API.

---

## If something looks wrong

### Stuck logged in / can’t log out
Browser console (F12 → Console), paste and Enter:

```js
localStorage.removeItem('lilbird-nest-auth');
location.reload();
```

### Page looks ugly / broken layout
- Re-upload `nest-styles.css` and `nest/index.html`
- Hard refresh (Cmd + Shift + R)
- In DevTools → Network, confirm `nest-styles.css` loads (status 200)

### “No users” in Supabase but Nest logged me in
- Check **Authentication → Users**, not `course_users`
- Confirm you’re in project **mebqqzbuwkogdxvnihrq**

### Red error banner on dashboard
- Usually means `user_entitlements` table missing or SQL didn’t run
- Re-run `nest/user_entitlements.sql` in Supabase SQL Editor

### All cards still locked after grant
- `user_id` in `user_entitlements` must **exactly** match the UID from Authentication → Users
- `active` must be `true`
- `product` must be spelled exactly: `inner_compass`, `solo_course`, `first_flight`, or `life_change_intensive`

---

## What Cursor already built for you (don’t rebuild)

| File | Purpose |
|------|---------|
| `nest/index.html` | Login + dashboard shell |
| `nest/nest-client.js` | Auth, cards, tabs, chat |
| `nest/nest-styles.css` | Visual design |
| `nest/user_entitlements.sql` | Run once in Supabase |
| `nest/admin-grant.js` | Optional CLI grants |
| `LILBIRD-MASTER.md` | Big-picture architecture |
| `LILBIRD-UPDATE-LOG.md` | Change history |

Solo Course at `/solo/` was **not** changed. Safe.

---

## Copy-paste message for Cursor when you return

> I’m back on Nest setup. I’ve read `nest/NEST-SETUP-GUIDE.md`. Please help me finish Thing 1–3 and verify https://lilbird.life/nest/ — I can share screenshots or Supabase access if needed.

---

*Last updated: 2026-05-27 — includes logout + layout fixes (upload `?v=2` files).*
