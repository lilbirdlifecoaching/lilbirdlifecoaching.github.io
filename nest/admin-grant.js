#!/usr/bin/env node
/**
 * Manual entitlement grant script.
 *
 * Usage:
 *   node nest/admin-grant.js sarah@example.com first_flight
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mebqqzbuwkogdxvnihrq.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const VALID_PRODUCTS = new Set(['inner_compass', 'solo_course', 'first_flight', 'life_change_intensive']);

function die(msg) {
  console.error(msg);
  process.exit(1);
}

async function getUserByEmail(email) {
  const url = `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Could not fetch user by email: ${err}`);
  }
  const body = await res.json();
  const list = Array.isArray(body?.users) ? body.users : [];
  return list[0] || null;
}

async function upsertEntitlement(userId, product) {
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_entitlements?user_id=eq.${encodeURIComponent(userId)}&product=eq.${encodeURIComponent(product)}&select=id,active`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  );
  if (!existingRes.ok) {
    const err = await existingRes.text();
    throw new Error(`Could not check existing entitlement: ${err}`);
  }
  const rows = await existingRes.json();

  if (rows?.length) {
    const id = rows[0].id;
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/user_entitlements?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        active: true,
        granted_by: 'manual',
        granted_at: new Date().toISOString()
      })
    });
    if (!patchRes.ok) {
      const err = await patchRes.text();
      throw new Error(`Could not update entitlement: ${err}`);
    }
    return { mode: 'updated', row: (await patchRes.json())[0] };
  }

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/user_entitlements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      user_id: userId,
      product,
      granted_by: 'manual',
      active: true
    })
  });
  if (!insertRes.ok) {
    const err = await insertRes.text();
    throw new Error(`Could not insert entitlement: ${err}`);
  }
  return { mode: 'inserted', row: (await insertRes.json())[0] };
}

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  const product = (process.argv[3] || '').trim();

  if (!email || !product) {
    die('Usage: node nest/admin-grant.js <email> <product>');
  }
  if (!VALID_PRODUCTS.has(product)) {
    die(`Invalid product. Use one of: ${Array.from(VALID_PRODUCTS).join(', ')}`);
  }
  if (!SUPABASE_SERVICE_KEY) {
    die('Missing SUPABASE_SERVICE_KEY env var.');
  }

  const user = await getUserByEmail(email);
  if (!user) die(`No auth user found for email: ${email}`);

  const result = await upsertEntitlement(user.id, product);
  console.log(`Entitlement ${result.mode}: ${product} for ${email}`);
  console.log(`user_id: ${user.id}`);
  console.log(`row_id: ${result.row.id}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
