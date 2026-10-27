import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { TOOLS } from './journey-tools.js';
import { CHECKINS, LETTERS, WELCOME } from './nest-letters-copy.js';
import {
  DAY_MS,
  DEFAULT_SCHEDULE,
  PRODUCT_FLOWS,
  advanceAfterSend,
  applyAccountEvent,
  consumeIntent,
  createMemoryStore,
  createSupabaseLetterStore,
  deliveryKey,
  emailVerified,
  enroll,
  heldDeliveryView,
  resolveHeldDelivery,
  IDEMPOTENCY_WINDOW_MS,
  letterStartAt,
  planSend,
  preferenceView,
  productSendAllowed,
  runTick,
  scheduleRetry,
  unsubscribe,
} from './nest-letters-delivery.js';
import {
  LETTER_COUNT,
  archetypeName,
  auditEmail,
  compassLine,
  greeting,
  preferredFirstName,
  renderNote,
  toolUrl,
} from './nest-letters.js';
import { preferenceCard } from './nest-letters-ui.js';
import {
  RESEND_SEND_URL,
  classifyResendSend,
  deliverNestLetter,
  letterFlags,
  letterUserFromRequest,
  noteForKey,
  routeNestLetters,
  runNestLetterCron,
  signNestToken,
} from './nest-letters-worker.js';

const catalog = new Set(TOOLS.map((tool) => tool.id));
const day = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-10-26T15:00:00Z');

function user(extra = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'lilbird.review.a@example.com',
    email_confirmed_at: '2026-10-01T00:00:00Z',
    user_metadata: { preferred_name: 'Sam' },
    ...extra,
  };
}

test('all 26 letters use live tool deep links', () => {
  assert.equal(LETTERS.length, 26);
  assert.equal(LETTER_COUNT, 26);
  const seen = new Set();
  for (const letter of LETTERS) {
    assert.equal(letter.n, LETTERS.indexOf(letter) + 1);
    assert.ok(letter.subject && letter.preheader && letter.paragraphs.length >= 4);
    assert.ok(catalog.has(letter.toolId), letter.toolId);
    seen.add(letter.toolId);
    assert.equal(toolUrl(letter.toolId), `https://lilbird.life/nest/?tool=${letter.toolId}`);
    const message = renderNote(letter, {
      firstName: 'Sam',
      unsubUrl: 'https://lilbird.life/unsub',
      mailingAddress: 'PO Box 1',
    });
    assert.deepEqual(auditEmail(message, { expectTool: true }), []);
    assert.match(message.html, new RegExp(`/nest/\\?tool=${letter.toolId}`));
    assert.match(message.text, /Hello Sam,/);
    assert.equal(message.from, "lil' bird <hello@lilbird.life>");
    assert.equal(message.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  }
  assert.equal(seen.size, 15);
  const tour = readFileSync(new URL('./nest-tour.js', import.meta.url), 'utf8');
  assert.match(tour, /__nestSkipTourForTool/);
  for (const note of CHECKINS) {
    const message = renderNote(note, { unsubUrl: 'https://lilbird.life/unsub', mailingAddress: 'PO Box 1' });
    assert.deepEqual(auditEmail(message, { expectCanvas: true }), []);
  }
});

test('name and Inner Compass personalization fall back without blocking', () => {
  assert.equal(preferredFirstName(user()), 'Sam');
  assert.equal(preferredFirstName({ user_metadata: { full_name: 'Sam Rivera' } }), 'Sam');
  assert.equal(preferredFirstName({ user_metadata: { full_name: 'Sam@' } }), '');
  assert.equal(greeting(''), 'Hello,');
  const letter = LETTERS.find((item) => item.compass);
  assert.equal(compassLine(letter, null), '');
  assert.equal(compassLine(letter, { attachmentDetail: 'private' }), '');
  assert.equal(archetypeName({ likelyCoreArchetypePlain: 'A long clinical paragraph about a wound and a score of 12.' }), '');
  const line = compassLine(letter, { likelyCoreArchetypePlain: 'Steady Gardener' });
  assert.match(line, /Steady Gardener/);
  const plain = renderNote(letter, { unsubUrl: 'https://lilbird.life/unsub' });
  assert.doesNotMatch(plain.text, /Steady Gardener/);
  const named = renderNote(letter, { profile: { likelyCoreArchetypePlain: 'Steady Gardener' }, unsubUrl: 'https://lilbird.life/unsub' });
  assert.match(named.text, /Steady Gardener/);
});

test('new members enroll only after the email is verified', () => {
  const unverified = enroll({ user: user({ email_confirmed_at: null }), choice: 'yes', now });
  assert.equal(unverified.ok, false);
  assert.equal(unverified.reason, 'unverified');
  assert.equal(emailVerified(user({ email_confirmed_at: null, confirmed_at: null })), false);
  const enrolled = enroll({ user: user(), choice: 'yes', now });
  assert.equal(enrolled.ok, true);
  assert.equal(enrolled.state.step, 0);
  assert.equal(enrolled.state.welcomeSent, false);
  assert.equal(enrolled.state.nestCoaching, true);
  assert.equal(enrolled.state.userId, user().id);
  const declined = enroll({ user: user(), choice: 'no', now });
  assert.equal(declined.state.status, 'declined');
  assert.equal(declined.state.nextAt, null);
});

test('a previous unsubscribe needs a clear yes before letters start again', () => {
  const blocked = enroll({ user: user(), choice: 'yes', now, suppressed: true });
  assert.equal(blocked.reason, 'unsubscribed');
  const again = enroll({ user: user(), choice: 'yes', now, suppressed: true, reaffirm: true });
  assert.equal(again.ok, true);
  assert.equal(again.clearGlobalSuppression, true);
  const stopped = unsubscribe({ ...again.state, step: 7, phase: 'letters', welcomeSent: true }, now);
  const resume = enroll({ user: user(), choice: 'yes', now, existing: stopped.state });
  assert.equal(resume.reason, 'unsubscribed');
  const affirmed = enroll({ user: user(), choice: 'yes', now, existing: stopped.state, reaffirm: true });
  assert.equal(affirmed.state.step, 7);
  assert.equal(affirmed.state.phase, 'letters');
  assert.equal(affirmed.state.status, 'active');
});

test('each member has their own timeline', () => {
  const early = letterStartAt(now, { enrolledAt: '2026-10-01T00:00:00Z', done: false });
  const later = letterStartAt(now, { enrolledAt: '2026-10-20T00:00:00Z', done: false });
  assert.ok(later > early);
  const finished = letterStartAt(now, { enrolledAt: '2026-01-01T00:00:00Z', done: true });
  const none = letterStartAt(now, null);
  assert.equal(finished, now + DEFAULT_SCHEDULE.introDelayDays * DAY_MS);
  assert.equal(none, finished);
  const custom = letterStartAt(now, null, { ...DEFAULT_SCHEDULE, introDelayDays: 5 });
  assert.equal(custom, now + 5 * DAY_MS);
  const activeEnd = Date.parse('2026-10-20T00:00:00Z') + (24 + 14) * DAY_MS;
  assert.equal(later, activeEnd);
});

test('a purchase does not move the Nest journey, and product flows stay listed', () => {
  const state = enroll({ user: user(), choice: 'yes', now }).state;
  state.step = 7;
  state.phase = 'letters';
  state.welcomeSent = true;
  const after = applyAccountEvent(state);
  assert.equal(after.step, 7);
  assert.equal(after.nextAt, state.nextAt);
  assert.deepEqual(PRODUCT_FLOWS, ['ff', 'coaching', 'solo', 'abandoned', 'quiz', 'glow', 'checkin']);
  assert.equal(PRODUCT_FLOWS.includes('nest'), false);
  assert.equal(productSendAllowed(null), true);
  assert.equal(productSendAllowed({ productCoaching: false }), false);
  assert.equal(productSendAllowed({ productCoaching: true, nestCoaching: false }), true);
});

test('letter 26 hands the member to a quarterly canvas check-in', () => {
  const state = {
    userId: user().id,
    welcomeSent: true,
    phase: 'letters',
    step: 25,
    status: 'active',
    nestCoaching: true,
    checkinCycle: 0,
  };
  const next = advanceAfterSend(state, now);
  assert.equal(next.phase, 'checkin');
  assert.equal(next.step, 0);
  assert.equal(next.nextAt, now + 90 * DAY_MS);
  const following = advanceAfterSend(next, next.nextAt);
  assert.equal(following.step, 1);
  assert.equal(following.nextAt - next.nextAt, 90 * DAY_MS);
});

test('a failed send keeps the same letter and a later success moves one step', async () => {
  const store = createMemoryStore();
  const enrolled = enroll({ user: user(), choice: 'yes', now, schedule: { ...DEFAULT_SCHEDULE, introDelayDays: 2 } });
  await store.saveState(enrolled.state);
  let calls = 0;
  const failed = await runTick({
    store,
    now,
    send: async () => {
      calls += 1;
      return { ok: false };
    },
  });
  assert.equal(failed.failed, 1);
  let state = await store.getState(user().id);
  assert.equal(state.step, 0);
  assert.equal(state.welcomeSent, false);
  assert.equal(state.attempt, 1);
  assert.ok(state.nextAt > now);
  const sent = await runTick({
    store,
    now: state.nextAt,
    send: async () => ({ ok: true }),
  });
  assert.equal(sent.sent, 1);
  assert.equal(calls, 1);
  state = await store.getState(user().id);
  assert.equal(state.welcomeSent, true);
  assert.equal(state.step, 0);
  assert.equal(state.phase, 'letters');
});

test('progress is not advanced before delivery, and a recorded send is not repeated', async () => {
  const store = createMemoryStore();
  await store.saveState(enroll({ user: user(), choice: 'yes', now }).state);
  const id = `${user().id}:welcome`;
  await store.claim(id, now);
  await store.markSent(id, now);
  let calls = 0;
  const repaired = await runTick({
    store,
    now,
    send: async () => {
      calls += 1;
      return { ok: true };
    },
  });
  assert.equal(repaired.repaired, 1);
  assert.equal(calls, 0);
  const state = await store.getState(user().id);
  assert.equal(state.welcomeSent, true);
});

test('a second cron run does not send the same letter', async () => {
  const store = createMemoryStore();
  await store.saveState(enroll({ user: user(), choice: 'yes', now }).state);
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const first = runTick({
    store,
    now,
    send: () => gate.then(() => ({ ok: true })),
  });
  const second = await runTick({ store, now, send: async () => ({ ok: true }) });
  assert.deepEqual(second, { skipped: 'lock' });
  release();
  const done = await first;
  assert.equal(done.sent, 1);
});

test('another email due the same day defers the letter without skipping it', () => {
  const state = enroll({ user: user(), choice: 'yes', now }).state;
  const plan = planSend({ state, now, otherMailDue: true });
  assert.equal(plan.action, 'defer');
  assert.equal(plan.nextAt, now + DAY_MS);
  const later = planSend({ state: { ...state, nextAt: plan.nextAt }, now: plan.nextAt, otherMailDue: false });
  assert.equal(later.letterKey, 'welcome');
});

test('unsubscribe links and preference changes', async () => {
  const secret = 'test-secret';
  const token = await signNestToken(secret, user().id);
  const store = createMemoryStore();
  await store.saveState(enroll({ user: user(), choice: 'yes', now }).state);
  const env = { UNSUBSCRIBE_SECRET: secret, NEST_LETTERS_ENABLED: 'false', MAILING_ADDRESS: 'PO Box 1' };
  const deps = {
    store,
    now: () => now,
    getUser: async () => user(),
    flags: async () => ({ suppressed: false, finishedWelcome: false }),
    clearSuppression: async () => {},
  };
  const url = `https://worker.test/nest-letters/unsubscribe?u=${user().id}&t=${token}`;
  const confirm = await routeNestLetters(new Request(url), env, deps);
  assert.match(await confirm.text(), /Stop the Nest notes/);
  const gone = await routeNestLetters(new Request(url, { method: 'POST' }), env, deps);
  assert.match(await gone.text(), /unsubscribed/i);
  const state = await store.getState(user().id);
  assert.equal(state.status, 'unsubscribed');
  assert.equal(state.nestCoaching, false);
  assert.equal(state.productCoaching, true);
  const cron = await runNestLetterCron(env, deps);
  assert.deepEqual(cron, { skipped: 'disabled' });
});

test('preferences ignore a browser-supplied email and keep accounts apart', async () => {
  const store = createMemoryStore();
  const env = { NEST_LETTERS_ENABLED: 'false' };
  const a = user();
  const b = user({ id: '22222222-2222-4222-8222-222222222222', email: 'lilbird.review.b@example.com' });
  let current = a;
  const deps = {
    store,
    now: () => now,
    getUser: async () => current,
    flags: async () => ({ suppressed: false, finishedWelcome: true, seq: { done: true, enrolledAt: '2026-01-01T00:00:00Z' } }),
    clearSuppression: async () => {},
  };
  const bad = await routeNestLetters(new Request('https://worker.test/nest-letters/preference', {
    method: 'POST',
    body: JSON.stringify({ email: 'someone-else@example.com', nestCoaching: true }),
  }), env, deps);
  assert.equal(bad.status, 400);
  const saved = await routeNestLetters(new Request('https://worker.test/nest-letters/preference', {
    method: 'POST',
    body: JSON.stringify({ nestCoaching: true }),
  }), env, deps);
  assert.equal(saved.status, 200);
  current = b;
  const other = await routeNestLetters(new Request('https://worker.test/nest-letters/preference'), env, deps);
  const body = await other.json();
  assert.equal(body.status, 'none');
  assert.equal(body.userId, b.id);
  assert.notEqual(preferenceView(a, await store.getState(a.id)).userId, b.id);
});

test('signup intent does not cross accounts, and the worker source leaves Beehiiv alone', () => {
  const map = { [user().id]: 'no' };
  const other = consumeIntent(map, '22222222-2222-4222-8222-222222222222');
  assert.equal(other, null);
  const used = consumeIntent(map, user().id);
  assert.equal(used.choice, 'no');
  assert.equal(used.rest[user().id], undefined);
  const worker = readFileSync(new URL('./nest-letters-worker.js', import.meta.url), 'utf8');
  const delivery = readFileSync(new URL('./nest-letters-delivery.js', import.meta.url), 'utf8');
  assert.doesNotMatch(worker, /beehiiv/i);
  assert.doesNotMatch(delivery, /beehiiv/i);
  assert.match(worker, /NEST_LETTERS_ENABLED/);
  assert.match(readFileSync(new URL('./nest-letters.sql', import.meta.url), 'utf8'), /nest_letter_try_lock/);
});

test('the invitation honors a finished welcome series and a prior unsubscribe', () => {
  const fresh = preferenceCard({ verified: true, status: 'none', nestCoaching: false, needsReaffirm: false, finishedWelcome: false, userId: 'a' });
  assert.match(fresh, /Send me the notes/);
  assert.doesNotMatch(fresh, /only hear from me/);
  const promised = preferenceCard({ verified: true, status: 'none', nestCoaching: false, needsReaffirm: true, finishedWelcome: true, userId: 'a' });
  assert.match(promised, /only hear from me if you wanted to/);
  assert.match(promised, /previously unsubscribed/);
  assert.match(promised, /data-letters-reaffirm="yes"/);
  const prefs = preferenceCard({ verified: true, status: 'active', nestCoaching: true, productCoaching: true, needsReaffirm: false, userId: 'a' });
  assert.match(prefs, /Nest coaching emails/);
  assert.match(prefs, /Product coaching emails/);
  assert.match(prefs, /lilbird\.beehiiv\.com/);
  assert.match(prefs, /does not add or remove you/);
});

test('the durable store refuses a second lock, and auth keeps the confirmed email', async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes('auth/v1/user')) {
      return {
        ok: true,
        json: async () => ({
          id: user().id,
          email: 'Lilbird.Review.A@example.com',
          email_confirmed_at: '2026-10-01T00:00:00Z',
          user_metadata: { preferred_name: 'Sam' },
        }),
      };
    }
    if (String(url).includes('nest_letter_try_lock')) return { ok: true, json: async () => false };
    return { ok: true, status: 200, json: async () => [] };
  };
  const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_KEY: 'service' };
  const loaded = await letterUserFromRequest(new Request('https://worker.test/', { headers: { Authorization: 'Bearer tok' } }), env, fetchImpl);
  assert.equal(loaded.email, user().email);
  assert.equal(emailVerified(loaded), true);
  const missed = await letterUserFromRequest(new Request('https://worker.test/'), env, fetchImpl);
  assert.equal(missed, null);
  const store = createSupabaseLetterStore(env, fetchImpl);
  const tick = await runTick({ store, now, send: async () => ({ ok: true }) });
  assert.deepEqual(tick, { skipped: 'lock' });
  const flags = await letterFlags(user(), {
    NEST_PROFILES: {
      async get(key) { return String(key).startsWith('unsub:') ? '1' : null; },
      async getWithMetadata() {
        return { value: JSON.stringify({ enrolledAt: '2026-01-01T00:00:00Z' }), metadata: { d: true, s: 10 } };
      },
    },
  });
  assert.equal(flags.suppressed, true);
  assert.equal(flags.finishedWelcome, true);
  assert.equal(flags.seq.enrolledAt, '2026-01-01T00:00:00Z');
});

test('retry keeps the letter number', () => {
  const state = enroll({ user: user(), choice: 'yes', now }).state;
  const retried = scheduleRetry(state, now);
  assert.equal(retried.step, state.step);
  assert.equal(retried.attempt, 1);
  assert.equal(noteForKey('n01').n, 1);
  assert.equal(noteForKey('n26').n, 26);
  assert.equal(noteForKey('q0-0').key, 'canvas-1');
});

test('signup consent starts unticked and declining still leaves a Nest choice', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const box = html.slice(html.indexOf('id="signup-letters"'), html.indexOf('id="signup-letters"') + 80);
  assert.match(box, /type="checkbox"/);
  assert.doesNotMatch(box, /checked/);
  assert.doesNotMatch(html, /signup-letters[\s\S]{0,40}required/);
  assert.match(html, /fortnightly coaching notes/);
  assert.match(html, /quarterly Life Canvas check-ins/);
  assert.match(html, /Leaving this unticked still creates your Nest/);
  const client = readFileSync(new URL('./nest-client.js', import.meta.url), 'utf8');
  const signupAt = client.indexOf('sb.auth.signUp');
  const choiceAt = client.indexOf("getElementById('signup-letters')?.checked === true");
  assert.ok(signupAt > 0 && choiceAt > signupAt);
  assert.doesNotMatch(client, /if \(!acceptLetters\) return/);
  const declined = enroll({ user: user(), choice: 'no', now });
  assert.equal(declined.ok, true);
  assert.equal(declined.state.status, 'declined');
  assert.equal(declined.state.nestCoaching, false);
  assert.equal(declined.state.nextAt, null);
});

test('provider acceptance followed by a crash does not advance, and the retry reuses the key', async () => {
  const store = createMemoryStore();
  const starting = enroll({ user: user(), choice: 'yes', now }).state;
  starting.welcomeSent = true;
  starting.phase = 'letters';
  starting.step = 4;
  await store.saveState(starting);
  let crash = true;
  const keys = [];
  const original = store.markSent.bind(store);
  store.markSent = async (id, at) => {
    if (crash) throw new Error('worker stopped after the provider accepted');
    return original(id, at);
  };
  const send = async ({ deliveryId }) => {
    keys.push(deliveryId);
    return { ok: true };
  };
  const first = await runTick({ store, now, send });
  assert.equal(first.uncertain, 1);
  assert.equal(first.sent, 0);
  let saved = await store.getState(user().id);
  assert.equal(saved.step, 4);
  assert.equal(saved.phase, 'letters');
  crash = false;
  const second = await runTick({ store, now: saved.nextAt, send });
  assert.equal(second.sent, 1);
  saved = await store.getState(user().id);
  assert.equal(saved.step, 5);
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
  assert.equal(keys[0], deliveryKey(user().id, 'n05'));
});

test('a second claim cannot take a letter the first claim still holds', async () => {
  const memory = createMemoryStore();
  const id = deliveryKey(user().id, 'welcome');
  const first = await memory.claim(id, now);
  const second = await memory.claim(id, now);
  assert.equal(first.claimed, true);
  assert.equal(second.inProgress, true);

  let posts = 0;
  const fetchImpl = async (url, options = {}) => {
    const method = options.method || 'GET';
    if (String(url).includes('nest_letter_deliveries') && method === 'GET') {
      return { ok: true, status: 200, json: async () => [] };
    }
    if (method === 'POST') {
      posts += 1;
      if (posts > 1) return { ok: false, status: 409, json: async () => ({ code: '23505' }) };
      return { ok: true, status: 201, json: async () => [{}] };
    }
    return { ok: true, status: 200, json: async () => [] };
  };
  const remote = createSupabaseLetterStore(
    { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_KEY: 'service' },
    fetchImpl,
  );
  const won = await remote.claim(id, now);
  const lost = await remote.claim(id, now);
  assert.equal(won.claimed, true);
  assert.equal(lost.inProgress, true);
  assert.equal(lost.claimed, undefined);
});

test('an uncertain delivery past the provider window is held instead of sent again', async () => {
  const store = createMemoryStore();
  const starting = enroll({ user: user(), choice: 'yes', now }).state;
  starting.welcomeSent = true;
  starting.phase = 'letters';
  starting.step = 2;
  await store.saveState(starting);
  const id = deliveryKey(user().id, 'n03');
  await store.claim(id, now - IDEMPOTENCY_WINDOW_MS - 1000);
  let calls = 0;
  const result = await runTick({
    store,
    now,
    send: async () => {
      calls += 1;
      return { ok: true };
    },
  });
  assert.equal(result.held, 1);
  assert.equal(calls, 0);
  const saved = await store.getState(user().id);
  assert.equal(saved.step, 2);
  assert.equal(saved.nextAt, null);
  assert.equal(saved.deliveryHold, true);
});

test('the cron asks Resend to dedupe on the delivery id', async () => {
  const store = createMemoryStore();
  await store.saveState(enroll({ user: user(), choice: 'yes', now }).state);
  let header = '';
  const env = { NEST_LETTERS_ENABLED: 'true', MAILING_ADDRESS: 'PO Box 1', UNSUBSCRIBE_SECRET: 'test-secret' };
  const result = await runNestLetterCron(env, {
    store,
    now: () => now,
    loadContext: async () => ({ profile: null, suppressed: false }),
    deliver: async (message) => {
      header = message.headers['Idempotency-Key'];
      return { ok: true };
    },
  });
  assert.equal(result.sent, 1);
  assert.equal(header, deliveryKey(user().id, 'welcome'));
});

test('the review document contains every note without requiring the source file', () => {
  const review = readFileSync(new URL('../docs/NEST-LETTER-REVIEW.md', import.meta.url), 'utf8');
  assert.match(review, /Welcome/);
  const notes = [WELCOME, ...LETTERS, ...CHECKINS];
  for (const note of notes) {
    assert.ok(review.includes(note.subject), note.subject);
    assert.ok(review.includes(note.preheader), note.preheader);
    for (const paragraph of note.paragraphs) assert.ok(review.includes(paragraph), paragraph.slice(0, 48));
    if (note.toolId) assert.ok(review.includes(`/nest/?tool=${note.toolId}`));
    if (typeof note.compass === 'function') assert.ok(review.includes(note.compass('{{archetype}}')));
  }
  assert.match(review, /\{\{firstName\}\}/);
  assert.match(review, /tab=canvas/);
  assert.equal(LETTERS.filter((letter) => letter.compass).length, 6);
});

test('an archetype line stays optional and does not diagnose', () => {
  for (const letter of LETTERS.filter((item) => item.compass)) {
    assert.equal(compassLine(letter, null), '');
    const line = letter.compass('Quiet Builder');
    assert.equal(line.includes('you are a'), false);
    assert.ok(line.length < 320);
    const message = renderNote(letter, { firstName: '', profile: null, to: 'a@example.com', mailingAddress: 'PO Box 1' });
    assert.equal(message.text.includes('Quiet Builder'), false);
    assert.deepEqual(auditEmail(message, { expectTool: true }), []);
  }
});

test('Resend dedupes the single-email endpoint, including a changed body', async () => {
  assert.equal(RESEND_SEND_URL, 'https://api.resend.com/emails');
  assert.equal(classifyResendSend(409, { name: 'concurrent_idempotent_requests' }).uncertain, true);
  assert.equal(classifyResendSend(500, {}).uncertain, true);
  assert.equal(classifyResendSend(422, { name: 'validation_error' }).ok, false);
  const sent = [];
  const fetchImpl = async (url, options) => {
    assert.equal(url, RESEND_SEND_URL);
    assert.equal(options.method, 'POST');
    const key = options.headers['Idempotency-Key'];
    const previous = sent.find((item) => item.key === key);
    if (previous && previous.body === options.body) return { status: 200, json: async () => ({ id: previous.id }) };
    if (previous) return { status: 409, json: async () => ({ name: 'invalid_idempotent_request' }) };
    sent.push({ key, body: options.body, id: 'email_1' });
    return { status: 200, json: async () => ({ id: 'email_1' }) };
  };
  const message = renderNote(WELCOME, { to: 'a@example.com', mailingAddress: 'PO Box 1' });
  message.headers['Idempotency-Key'] = deliveryKey(user().id, 'welcome');
  const first = await deliverNestLetter({ RESEND_API_KEY: 'test-key' }, message, fetchImpl);
  const second = await deliverNestLetter({ RESEND_API_KEY: 'test-key' }, message, fetchImpl);
  const changed = await deliverNestLetter({ RESEND_API_KEY: 'test-key' }, { ...message, subject: 'A different subject' }, fetchImpl);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(changed.idempotentConflict, true);
  assert.equal(sent.length, 1);
  assert.equal(JSON.parse(sent[0].body).subject, WELCOME.subject);
});

test('a crash after acceptance recovers inside the window without a second email', async () => {
  const store = createMemoryStore();
  await store.saveState(enroll({ user: user(), choice: 'yes', now }).state);
  const sent = [];
  let record = false;
  const original = store.markSent.bind(store);
  store.markSent = async (id, at) => {
    if (!record) throw new Error('worker stopped');
    return original(id, at);
  };
  const env = { NEST_LETTERS_ENABLED: 'true', MAILING_ADDRESS: 'PO Box 1', UNSUBSCRIBE_SECRET: 'test-secret', RESEND_API_KEY: 'test-key' };
  const fetchImpl = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    const key = options.headers['Idempotency-Key'];
    const previous = sent.find((item) => item.key === key && item.body === options.body);
    if (previous) return { status: 200, json: async () => ({ id: previous.id }) };
    sent.push({ key, body: options.body, id: 'email_9' });
    return { status: 200, json: async () => ({ id: 'email_9' }) };
  };
  const first = await runNestLetterCron(env, { store, now: () => now, loadContext: async () => ({ profile: null }), fetch: fetchImpl });
  assert.equal(first.uncertain, 1);
  assert.equal((await store.getState(user().id)).welcomeSent, false);
  record = true;
  const saved = await store.getState(user().id);
  const second = await runNestLetterCron(env, { store, now: () => saved.nextAt, loadContext: async () => ({ profile: null }), fetch: fetchImpl });
  assert.equal(second.sent, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].key, deliveryKey(user().id, 'welcome'));
});

test('a held letter can be marked sent, and a retry needs an explicit duplicate warning', async () => {
  const store = createMemoryStore();
  const starting = enroll({ user: user(), choice: 'yes', now }).state;
  starting.welcomeSent = true;
  starting.phase = 'letters';
  starting.step = 3;
  starting.attempt = 3;
  await store.saveState(starting);
  const id = deliveryKey(user().id, 'n04');
  await store.claim(id, now - IDEMPOTENCY_WINDOW_MS - 1000);
  let calls = 0;
  const held = await runTick({ store, now, send: async () => { calls += 1; return { ok: true }; } });
  assert.equal(held.held, 1);
  assert.equal(calls, 0);
  const view = heldDeliveryView(
    { id, letterKey: 'n04', status: 'uncertain', firstClaimedAt: now - IDEMPOTENCY_WINDOW_MS, uncertainAt: now },
    await store.getState(user().id),
  );
  assert.equal(view.email, user().email);
  assert.equal(view.letterNumber, 4);
  assert.equal(view.deliveryId, id);
  assert.equal(Object.hasOwn(view, 'paragraphs'), false);
  const refused = resolveHeldDelivery({ decision: 'retry', now });
  assert.equal(refused.ok, false);
  assert.equal(refused.resend, false);
  const marked = resolveHeldDelivery({ decision: 'mark-sent', now });
  assert.equal(marked.resend, false);
  await store.markSent(id, now);
  await store.saveState({ ...(await store.getState(user().id)), nextAt: now });
  const repaired = await runTick({ store, now, send: async () => { calls += 1; return { ok: true }; } });
  assert.equal(calls, 0);
  assert.equal(repaired.repaired, 1);
  assert.equal((await store.getState(user().id)).step, 4);
  const retry = resolveHeldDelivery({ decision: 'retry', confirmDuplicate: true, now });
  assert.equal(retry.duplicatePossible, true);
  const guide = readFileSync(new URL('../docs/NEST-LETTERS.md', import.meta.url), 'utf8');
  assert.match(guide, /Idempotency-Key/);
  assert.match(guide, /https:\/\/api\.resend\.com\/emails/);
  assert.match(guide, /duplicate is acceptable/);
  assert.match(guide, /does not show the letter text/);
});

