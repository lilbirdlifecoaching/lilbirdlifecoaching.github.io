/**
 * Assessment-worker adapter for Nest letters.
 * Wire this only into lilbird-assessment. Do not also call it from worker-solo.
 * runNestLetterCron does nothing unless NEST_LETTERS_ENABLED === "true".
 * This file does not subscribe anyone to the newsletter.
 */

import { CHECKINS, LETTERS, WELCOME } from './nest-letters-copy.js';
import {
  applyAccountEvent,
  emailVerified,
  preferenceView,
  runTick,
  setPreferences,
  unsubscribe,
} from './nest-letters-delivery.js';
import { letterByNumber, preferredFirstName, renderNote } from './nest-letters.js';

const ENABLED = 'true';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function page(title, message, formAction = '') {
  const button = formAction
    ? `<form method="POST" action="${formAction}"><button type="submit" style="margin-top:16px;padding:12px 18px;border:0;border-radius:8px;background:#F5C842;color:#1a1c23;font-size:16px;">Unsubscribe me</button></form>`
    : '';
  return new Response(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#1a1c23;color:#f0ead8;font-family:Georgia,serif;">
<main style="max-width:32rem;margin:12vh auto;padding:0 1.25rem;line-height:1.6;">
<h1 style="font-weight:400;font-style:italic;color:#F5C842;">${title}</h1>
<p>${message}</p>${button}
</main></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function letterUserFromRequest(request, env, fetchImpl = fetch) {
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return null;
  const res = await fetchImpl(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json();
  if (!user?.id || !user.email) return null;
  return {
    id: user.id,
    email: String(user.email).toLowerCase(),
    email_confirmed_at: user.email_confirmed_at || user.confirmed_at || null,
    user_metadata: user.user_metadata || {},
  };
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function letterFlags(user, env) {
  if (!user?.email || !env.NEST_PROFILES) return { suppressed: false, finishedWelcome: false, seq: null };
  const hash = await sha256Hex(String(user.email).trim().toLowerCase());
  const suppressed = !!(await env.NEST_PROFILES.get(`unsub:${hash}`));
  const seqRecord = await env.NEST_PROFILES.getWithMetadata(`seq:${hash}`);
  let enrolledAt = null;
  try {
    enrolledAt = JSON.parse(seqRecord?.value || '{}').enrolledAt || null;
  } catch {
    enrolledAt = null;
  }
  const meta = seqRecord?.metadata || null;
  const seq = meta ? { done: meta.d === true, enrolledAt } : null;
  return {
    suppressed,
    finishedWelcome: !!(meta && meta.d === true && Number(meta.s) >= 10),
    seq,
  };
}

export async function signNestToken(secret, userId) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret || ''),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`nest-unsub:${userId}`));
  return [...new Uint8Array(sig)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function unsubscribeUrl(env, userId) {
  const base = env.PUBLIC_WORKER_URL || 'https://lilbird-assessment.cwwq46sn7m.workers.dev';
  const token = await signNestToken(env.UNSUBSCRIBE_SECRET || env.RESEND_API_KEY || '', userId);
  return `${base}/nest-letters/unsubscribe?u=${encodeURIComponent(userId)}&t=${token}`;
}

export function noteForKey(letterKey) {
  if (letterKey === 'welcome') return WELCOME;
  const numbered = /^n(\d+)$/.exec(letterKey || '');
  if (numbered) return letterByNumber(Number(numbered[1]));
  const checkin = /^q\d+-(\d+)$/.exec(letterKey || '');
  if (checkin) return CHECKINS[Number(checkin[1]) % CHECKINS.length];
  return null;
}

async function readChoice(request) {
  const text = await request.text();
  const params = new URLSearchParams(text);
  if (params.get('List-Unsubscribe') === 'One-Click') return { oneClick: true };
  try {
    return JSON.parse(text || '{}');
  } catch {
    return {};
  }
}

export async function routeNestLetters(request, env, deps) {
  const url = new URL(request.url);
  if (url.pathname === '/nest-letters/unsubscribe') return handleUnsubscribe(request, env, deps, url);
  if (url.pathname === '/nest-letters/preference') return handlePreference(request, env, deps);
  return json({ error: 'Not found' }, 404);
}

async function handlePreference(request, env, deps) {
  const user = await deps.getUser(request, env);
  if (!user?.id) return json({ error: 'Please log in again.' }, 401);
  const record = await deps.store.getState(user.id);
  const flags = await deps.flags(user);
  if (request.method === 'GET') {
    return json({
      ...preferenceView(user, record, flags),
      sender: 'lilbird-assessment',
      sendsEnabled: env.NEST_LETTERS_ENABLED === ENABLED,
    });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const body = await readChoice(request);
  if (body.email) return json({ error: 'Email is taken from the signed-in account.' }, 400);
  const now = deps.now();
  const seq = flags.seq || null;
  let result;
  if (body.nestCoaching == null && body.productCoaching != null) {
    result = setPreferences({
      user,
      existing: record,
      now,
      productCoaching: body.productCoaching,
      suppressed: flags.suppressed,
      seq,
    });
  } else {
    result = setPreferences({
      user,
      existing: record,
      now,
      nestCoaching: body.nestCoaching === true,
      productCoaching: body.productCoaching,
      reaffirm: body.reaffirm === true,
      suppressed: flags.suppressed,
      seq,
    });
  }
  if (!result.ok) return json({ error: result.reason, view: preferenceView(user, record, flags) }, 409);
  if (result.clearGlobalSuppression) await deps.clearSuppression(user);
  await deps.store.saveState(result.state);
  return json({ ok: true, view: preferenceView(user, result.state, { ...flags, suppressed: flags.suppressed && !result.clearGlobalSuppression }) });
}

async function handleUnsubscribe(request, env, deps, url) {
  const userId = url.searchParams.get('u') || '';
  const token = url.searchParams.get('t') || '';
  const secret = env.UNSUBSCRIBE_SECRET || env.RESEND_API_KEY || '';
  const expected = secret ? await signNestToken(secret, userId) : '';
  if (!userId || !token || token !== expected) {
    return page('That link did not work', 'Reply to any note and I will turn these off by hand.');
  }
  const action = `${url.pathname}${url.search}`;
  if (request.method === 'GET') {
    return page('Stop the Nest notes?', 'This stops the fortnightly coaching notes and the quarterly Life Canvas check-ins. Your Nest stays. Product notes are a separate switch inside the Nest.', action);
  }
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const state = await deps.store.getState(userId);
  const result = unsubscribe(state, deps.now());
  if (result.ok) await deps.store.saveState(result.state);
  return page('You are unsubscribed', 'No more Nest coaching notes or quarterly check-ins. Your Nest is still there.');
}

export async function runNestLetterCron(env, deps) {
  if (env.NEST_LETTERS_ENABLED !== ENABLED) return { skipped: 'disabled' };
  if (!env.MAILING_ADDRESS) return { skipped: 'address' };
  return runTick({
    store: deps.store,
    now: deps.now(),
    schedule: deps.schedule,
    otherMailDue: deps.otherMailDue,
    loadContext: async (state) => {
      try {
        return await deps.loadContext(state);
      } catch {
        return { profile: null, suppressed: false };
      }
    },
    send: async ({ state, letterKey, deliveryId, context }) => {
      const note = noteForKey(letterKey);
      if (!note) return { ok: false };
      const user = { id: state.userId, email: state.email, user_metadata: context?.user_metadata || {} };
      const message = renderNote(note, {
        firstName: preferredFirstName(user),
        profile: context?.profile || null,
        to: state.email,
        unsubUrl: await unsubscribeUrl(env, state.userId),
        mailingAddress: env.MAILING_ADDRESS,
      });
      message.headers['X-Entity-Ref-ID'] = deliveryId;
      return deps.deliver(message);
    },
  });
}

export function accountEventLeavesLetters(state) {
  return applyAccountEvent(state);
}

export { emailVerified, LETTERS, WELCOME };
