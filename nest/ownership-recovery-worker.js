/**
 * Worker adapter for ownership recovery.
 * The confirmation is mailed only to the email already stored on the assessment.
 * A browser-supplied email is ignored. Nothing here reads or writes coaching letters.
 */

import {
  RECOVERY_TTL_MS,
  RECOVERY_WINDOW_MS,
  confirmedRecoveryEmail,
  newRecoveryToken,
  normalizeEmail,
  recentRecoveryAttempts,
  recoveryAssociation,
  recoveryConsumeDecision,
  recoveryRecord,
  recoveryRequestDecision,
} from './ownership-recovery.js';

const TOKEN_PREFIX = 'ownrec:';
const USER_RATE_PREFIX = 'ownrec-rate:';
const NEST_RATE_PREFIX = 'ownrec-nest:';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function readJson(kv, key) {
  if (!kv?.get) return null;
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function confirmUrl(token) {
  return `https://lilbird.life/inner-compass/#recover=${encodeURIComponent(token)}`;
}

export async function routeOwnershipRecovery(request, env, deps) {
  const url = new URL(request.url);
  if (request.method !== 'POST') return json({ error: 'Not allowed' }, 405);
  if (url.pathname === '/nest-ownership/request') return handleRecoveryRequest(request, env, deps);
  if (url.pathname === '/nest-ownership/confirm') return handleRecoveryConfirm(request, env, deps);
  return json({ error: 'Not found' }, 404);
}

async function handleRecoveryRequest(request, env, deps) {
  const user = await deps.getUser(request, env);
  let nestId = '';
  try {
    const body = await request.json();
    nestId = typeof body?.nestId === 'string' ? body.nestId.trim() : '';
  } catch {
    nestId = '';
  }
  if (!user?.id) return json({ error: 'Please log in.' }, 401);
  if (!/^[\w-]{8,80}$/.test(nestId)) return json({ ok: true, message: recoveryRequestDecision({ user, now: deps.now() }).body.message });

  const kv = env.NEST_PROFILES;
  const now = deps.now();
  const [userAttempts, nestAttempts] = await Promise.all([
    readJson(kv, USER_RATE_PREFIX + user.id),
    readJson(kv, NEST_RATE_PREFIX + nestId),
  ]);
  const record = await deps.loadRecord(env, nestId);
  const association = record ? await deps.association(user, nestId, env) : null;
  const decision = recoveryRequestDecision({
    user,
    storedEmail: record?.email || '',
    association,
    userAttempts,
    nestAttempts,
    now,
  });
  if (decision.status !== 200 || decision.body.owned) return json(decision.body, decision.status);

  const nextUser = recentRecoveryAttempts(userAttempts, now).concat(now);
  const nextNest = recentRecoveryAttempts(nestAttempts, now).concat(now);
  const rateTtl = Math.ceil(RECOVERY_WINDOW_MS / 1000);
  await kv.put(USER_RATE_PREFIX + user.id, JSON.stringify(nextUser), { expirationTtl: rateTtl });
  await kv.put(NEST_RATE_PREFIX + nestId, JSON.stringify(nextNest), { expirationTtl: rateTtl });

  if (!decision.send) return json(decision.body, decision.status);

  const token = newRecoveryToken();
  const key = TOKEN_PREFIX + await sha256Hex(token);
  await kv.put(key, JSON.stringify(recoveryRecord({ userId: user.id, nestId, now })), {
    expirationTtl: Math.ceil(RECOVERY_TTL_MS / 1000),
  });
  const mailed = await deps.sendMail(env, { to: decision.to, url: confirmUrl(token) });
  if (!mailed) await kv.delete(key);
  return json(decision.body, decision.status);
}

async function handleRecoveryConfirm(request, env, deps) {
  const user = await deps.getUser(request, env);
  if (!user?.id) return json({ error: 'Please log in.' }, 401);
  let token = '';
  try {
    const body = await request.json();
    token = typeof body?.token === 'string' ? body.token.trim() : '';
  } catch {
    token = '';
  }
  if (!/^[0-9a-f]{64}$/.test(token)) return json({ error: 'Not allowed' }, 403);
  const kv = env.NEST_PROFILES;
  const key = TOKEN_PREFIX + await sha256Hex(token);
  const record = await readJson(kv, key);
  const stored = record ? await deps.loadRecord(env, record.nestId) : null;
  const decision = recoveryConsumeDecision({
    record,
    user,
    storedEmail: stored?.email || '',
    now: deps.now(),
  });
  if (!decision.ok) {
    if (decision.consume) await kv.delete(key);
    return json(decision.body, decision.status);
  }
  const association = await deps.association(user, record.nestId, env);
  if (association === 'conflict') {
    await kv.delete(key);
    return json({ error: 'Not allowed' }, 403);
  }
  const storedOwner = normalizeEmail(await deps.bindOwner(env, record.nestId, decision.email));
  await kv.delete(key);
  if (storedOwner !== decision.email) return json({ error: 'Not allowed' }, 403);
  return json({ ok: true, nestId: record.nestId });
}

export async function sendRecoveryMail(env, { to, url }, fetchImpl = fetch) {
  if (!env?.RESEND_API_KEY || !to || !url) return false;
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: "lil' bird <hello@lilbird.life>",
      to: [to],
      subject: 'Confirm this Inner Compass for your Nest',
      html: `<p>Confirm that this Inner Compass belongs with the Nest you are signed in to.</p><p><a href="${url}">Confirm this read</a></p><p>This link expires in 30 minutes. If you did not ask for it, you can ignore it.</p>`,
    }),
  });
  return res.ok;
}

export { confirmedRecoveryEmail, recoveryAssociation };
