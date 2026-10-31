/**
 * Assessment-worker adapter for Nest letters.
 * Wire this only into lilbird-assessment. Do not also call it from worker-solo.
 * runNestLetterCron sends only when NEST_LETTERS_ENABLED is exactly "true"
 * and NEST_LETTERS_MODE is exactly "test" or "general".
 * An unset or any other mode sends nobody.
 * "test" sends only to a non-empty NEST_LETTERS_ALLOWLIST.
 * "general" sends to members who already opted in. A non-empty allowlist
 * still limits that run. An empty allowlist does not, by itself, turn
 * general delivery on.
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
import { archetypeProfileForLetter, letterByNumber, preferredFirstName, renderNote } from './nest-letters.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ENABLED = 'true';

/** Comma- or whitespace-separated Nest user ids. An empty list is not a mode. */
export function parseLetterAllowlist(value) {
  return new Set(
    String(value || '')
      .split(/[\s,]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Single-email endpoint. The batch endpoint is a different call and is not used here. */
export const RESEND_SEND_URL = 'https://api.resend.com/emails';

/**
 * Resend dedupes POST /emails when the Idempotency-Key and the JSON body both match,
 * for 24 hours. A repeated key with a different body returns 409 invalid_idempotent_request
 * and does not send a second email. A key already in flight returns 409 concurrent_idempotent_requests.
 */
export function classifyResendSend(status, body) {
  const name = body?.name || '';
  if (status >= 200 && status < 300) return { ok: true };
  if (status === 409 && name === 'invalid_idempotent_request') return { ok: true, idempotentConflict: true };
  if (status === 409 && name === 'concurrent_idempotent_requests') return { uncertain: true };
  if (status === 408 || status === 429 || status >= 500) return { uncertain: true };
  return { ok: false };
}

export async function deliverNestLetter(env, message, fetchImpl = fetch) {
  const key = message?.headers?.['Idempotency-Key'] || '';
  if (!key || key.length > 256) return { ok: false, reason: 'idempotency-key' };
  const res = await fetchImpl(RESEND_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
    },
    body: JSON.stringify({
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      reply_to: message.reply_to,
      headers: {
        'List-Unsubscribe': message.headers['List-Unsubscribe'],
        'List-Unsubscribe-Post': message.headers['List-Unsubscribe-Post'],
      },
    }),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const result = classifyResendSend(res.status, body);
  result.providerStatus = res.status;
  result.providerName = typeof body?.name === 'string' ? body.name : null;
  result.providerMessage = typeof body?.message === 'string' ? body.message.slice(0, 240) : null;
  if (body && typeof body.id === 'string') result.providerId = body.id;
  return result;
}

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

export function resolveLetterDelivery(env) {
  if (env?.NEST_LETTERS_ENABLED !== ENABLED) return { send: false, skipped: 'disabled' };
  const mode = String(env?.NEST_LETTERS_MODE || '').trim().toLowerCase();
  if (mode !== 'test' && mode !== 'general') return { send: false, skipped: 'mode' };
  if (!env.MAILING_ADDRESS) return { send: false, skipped: 'address' };
  const allow = parseLetterAllowlist(env.NEST_LETTERS_ALLOWLIST);
  if (mode === 'test' && allow.size === 0) return { send: false, skipped: 'allowlist' };
  return {
    send: true,
    mode,
    allowUser: allow.size
      ? (state) => allow.has(String(state.userId || '').trim().toLowerCase())
      : undefined,
  };
}

export function confirmedAccountEmail(user) {
  if (!emailVerified(user)) return '';
  const email = String(user.email || '').trim().toLowerCase();
  return EMAIL.test(email) ? email : '';
}

/**
 * A loaded account uses its confirmed address. An unconfirmed account waits.
 * A missing account leaves the stored address in place, which is the lookup-failure path.
 * email_change is never read.
 */
export function applyConfirmedRecipient(state, context) {
  const ctx = context && typeof context === 'object' ? { ...context } : {};
  if (!Object.prototype.hasOwnProperty.call(ctx, 'account')) return ctx;
  const confirmed = confirmedAccountEmail(ctx.account);
  if (!confirmed) return { ...ctx, awaitingVerifiedEmail: true, profile: null };
  return { ...ctx, recipientEmail: confirmed, awaitingVerifiedEmail: false };
}

export function deliveryReport(mode, summary) {
  const finishedAt = new Date().toISOString();
  if (!summary || typeof summary.skipped === 'string') {
    return { completed: false, skipped: summary?.skipped || 'unknown', mode: mode || null, finishedAt, attention: false };
  }
  const failed = summary.failed || 0;
  const held = summary.held || 0;
  const uncertain = summary.uncertain || 0;
  return {
    completed: true,
    mode,
    finishedAt,
    due: summary.due || 0,
    accepted: summary.sent || 0,
    failed,
    held,
    uncertain,
    deferred: summary.deferred || 0,
    skipped: summary.skipped || 0,
    attention: failed + held + uncertain > 0,
  };
}

/** Service-role desk row. Counts only, so a member address never lands in the alert. */
export function staffDeliveryAlert(report) {
  if (!report?.completed || report.attention !== true) return null;
  return {
    kind: 'nest-letters',
    email: null,
    user_id: null,
    detail: {
      finishedAt: report.finishedAt,
      mode: report.mode,
      accepted: report.accepted,
      failed: report.failed,
      held: report.held,
      uncertain: report.uncertain,
    },
  };
}

export const LAST_RUN_KEY = 'nest-letters:last-run';

export async function recordDeliveryReport(env, report) {
  if (!report?.completed || !env?.NEST_PROFILES?.put) return;
  const body = {
    completed: true,
    mode: report.mode,
    finishedAt: report.finishedAt,
    due: report.due,
    accepted: report.accepted,
    failed: report.failed,
    held: report.held,
    uncertain: report.uncertain,
    deferred: report.deferred,
    skipped: report.skipped,
    attention: report.attention === true,
  };
  await env.NEST_PROFILES.put(LAST_RUN_KEY, JSON.stringify(body));
}

export async function recordStaffDeliveryAlert(env, report, fetchImpl = fetch) {
  const row = staffDeliveryAlert(report);
  if (!row || !env?.SUPABASE_URL || !env?.SUPABASE_SERVICE_KEY) return;
  await fetchImpl(`${env.SUPABASE_URL}/rest/v1/desk_alerts`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
}

export async function runNestLetterCron(env, deps) {
  const gate = resolveLetterDelivery(env);
  if (!gate.send) return { skipped: gate.skipped };
  const summary = await runTick({
    allowUser: gate.allowUser,
    store: deps.store,
    now: deps.now(),
    schedule: deps.schedule,
    otherMailDue: deps.otherMailDue,
    loadContext: async (state) => {
      try {
        return applyConfirmedRecipient(state, await deps.loadContext(state));
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
        profile: archetypeProfileForLetter(context?.profile, state.email),
        to: state.email,
        unsubUrl: await unsubscribeUrl(env, state.userId),
        mailingAddress: env.MAILING_ADDRESS,
      });
      message.headers['Idempotency-Key'] = deliveryId;
      if (deps.deliver) return deps.deliver(message);
      return deliverNestLetter(env, message, deps.fetch);
    },
  });
  const report = deliveryReport(gate.mode, summary);
  try {
    if (deps.recordRun) await deps.recordRun(report);
    else await recordDeliveryReport(env, report);
    if (deps.recordAttention) await deps.recordAttention(report);
    else await recordStaffDeliveryAlert(env, report, deps.fetch);
  } catch {
    // Reporting must not change who was sent or advance a sequence.
  }
  return summary;
}

export function accountEventLeavesLetters(state) {
  return applyAccountEvent(state);
}

export { emailVerified, LETTERS, WELCOME };
