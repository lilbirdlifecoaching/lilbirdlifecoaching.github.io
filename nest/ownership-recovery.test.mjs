import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  RECOVERY_MESSAGE,
  confirmedRecoveryEmail,
  maySendRecovery,
  recoveryAssociation,
  recoveryConsumeDecision,
  recoveryLimited,
  recoveryRecord,
  recoveryRequestDecision,
} from './ownership-recovery.js';
import { confirmUrl, routeOwnershipRecovery } from './ownership-recovery-worker.js';

const now = Date.parse('2026-10-31T18:00:00Z');
const nestId = 'nest-11111111-1111-4111-8111-111111111111';
const member = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'member@example.com',
  email_confirmed_at: '2026-10-01T00:00:00Z',
};
const other = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'other@example.com',
  email_confirmed_at: '2026-10-01T00:00:00Z',
};

function memoryKv() {
  const map = new Map();
  return {
    map,
    async get(key) { return map.has(key) ? map.get(key) : null; },
    async put(key, value) { map.set(key, value); },
    async delete(key) { map.delete(key); },
  };
}

function harness(extra = {}) {
  const kv = extra.kv || memoryKv();
  const sent = [];
  const binds = [];
  const owners = extra.owners || new Map();
  const records = extra.records || {};
  const associations = extra.associations || {};
  const env = { NEST_PROFILES: kv, RESEND_API_KEY: 'test', ...extra.env };
  const deps = {
    getUser: async () => extra.user,
    loadRecord: async (_env, id) => records[id] || null,
    association: async (user, id) => (extra.association ? extra.association(user, id) : associations[id] || null),
    sendMail: extra.sendMail || (async (_env, message) => {
      sent.push(message);
      return extra.mailOk !== false;
    }),
    bindOwner: async (_env, id, email) => {
      if (!owners.has(id)) owners.set(id, email);
      binds.push({ id, email });
      return owners.get(id);
    },
    now: () => extra.now || now,
  };
  return { env, deps, sent, binds, kv, owners };
}

function recoveryToken(url) {
  const parsed = new URL(url);
  return new URLSearchParams(parsed.hash.replace(/^#/, '')).get('recover') || parsed.searchParams.get('recover');
}

async function post(path, body, bag) {
  const response = await routeOwnershipRecovery(new Request(`https://worker.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }), bag.env, bag.deps);
  return { status: response.status, body: await response.json() };
}

test('a matching email string is not ownership, and a legacy link is not either', () => {
  assert.equal(recoveryAssociation({ verifiedLink: false, hasRead: false, boundEmail: '', confirmedEmail: member.email }), null);
  assert.equal(maySendRecovery({ confirmedEmail: member.email, storedEmail: member.email }), true);
  const decision = recoveryRequestDecision({
    user: member,
    storedEmail: member.email,
    association: null,
    now,
  });
  assert.equal(decision.send, true);
  assert.equal(decision.body.owned, undefined);
  assert.equal(JSON.stringify(decision.body).includes(member.email), false);
  assert.equal(recoveryAssociation({
    verifiedLink: false,
    hasRead: false,
    boundEmail: 'other@example.com',
    confirmedEmail: member.email,
  }), 'conflict');
});

test('an unconfirmed account and a pending email change do not qualify', () => {
  const pending = {
    id: member.id,
    email: 'pending@example.com',
    email_confirmed_at: null,
    confirmed_at: null,
    email_change: member.email,
  };
  assert.equal(confirmedRecoveryEmail(pending), '');
  assert.equal(recoveryRequestDecision({ user: pending, storedEmail: 'pending@example.com', now }).send, false);
  assert.equal(confirmedRecoveryEmail(member), member.email);
});

test('a legitimate confirmation binds one ownership row and cannot be reused', async () => {
  const bag = harness({
    user: member,
    records: { [nestId]: { email: member.email, profile: { likelyCoreArchetypePlain: 'Kept Out' } } },
  });
  const first = await post('/nest-ownership/request', { nestId, email: 'typed@example.com' }, bag);
  assert.equal(first.status, 200);
  assert.equal(first.body.message, RECOVERY_MESSAGE);
  assert.equal(JSON.stringify(first.body).includes(member.email), false);
  assert.equal(JSON.stringify(first.body).includes('typed@example.com'), false);
  assert.equal(bag.sent.length, 1);
  assert.equal(bag.sent[0].to, member.email);
  assert.equal(bag.sent[0].url.includes('recover='), true);
  assert.equal(bag.sent[0].url.includes(nestId), false);
  assert.equal(bag.binds.length, 0);
  const token = recoveryToken(bag.sent[0].url);
  const paused = harness({
    user: null,
    kv: bag.kv,
    records: { [nestId]: { email: member.email } },
  });
  const interrupted = await post('/nest-ownership/confirm', { token }, paused);
  assert.equal(interrupted.status, 401);
  assert.equal(paused.binds.length, 0);
  const confirmed = await post('/nest-ownership/confirm', {
    token,
    email: 'typed@example.com',
    userId: other.id,
    nestId: 'nest-99999999-9999-4999-8999-999999999999',
  }, bag);
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.nestId, nestId);
  assert.deepEqual(bag.binds, [{ id: nestId, email: member.email }]);
  assert.equal(JSON.stringify(confirmed.body).includes('Kept Out'), false);
  const replay = await post('/nest-ownership/confirm', { token }, bag);
  assert.equal(replay.status, 403);
  assert.equal(bag.binds.length, 1);
});

test('the wrong account, the wrong stored email, and a guessed id send nothing', async () => {
  const match = harness({
    user: member,
    records: { [nestId]: { email: member.email } },
  });
  const mismatch = harness({
    user: other,
    records: { [nestId]: { email: member.email } },
  });
  const missing = harness({ user: member, records: {} });
  const a = await post('/nest-ownership/request', { nestId }, match);
  const b = await post('/nest-ownership/request', { nestId, email: member.email }, mismatch);
  const c = await post('/nest-ownership/request', { nestId: 'nest-22222222-2222-4222-8222-222222222222' }, missing);
  assert.equal(a.body.message, b.body.message);
  assert.equal(b.body.message, c.body.message);
  assert.equal(match.sent.length, 1);
  assert.equal(mismatch.sent.length, 0);
  assert.equal(missing.sent.length, 0);
  assert.equal(mismatch.binds.length, 0);
  const token = recoveryToken(match.sent[0].url);
  mismatch.kv = match.kv;
  mismatch.env.NEST_PROFILES = match.kv;
  const wrongUser = await post('/nest-ownership/confirm', { token }, mismatch);
  assert.equal(wrongUser.status, 403);
  assert.equal(match.binds.length, 0);
  const still = await post('/nest-ownership/confirm', { token }, match);
  assert.equal(still.status, 200);
  assert.equal(match.binds.length, 1);
});

test('an expired token is refused and a forged token does not grant', async () => {
  const bag = harness({
    user: member,
    records: { [nestId]: { email: member.email } },
  });
  await post('/nest-ownership/request', { nestId }, bag);
  const token = recoveryToken(bag.sent[0].url);
  const key = [...bag.kv.map.keys()].find((item) => item.startsWith('ownrec:'));
  const stored = JSON.parse(bag.kv.map.get(key));
  stored.expiresAt = new Date(now - 1000).toISOString();
  bag.kv.map.set(key, JSON.stringify(stored));
  const expired = await post('/nest-ownership/confirm', { token }, bag);
  assert.equal(expired.status, 403);
  assert.equal(bag.binds.length, 0);
  assert.equal(bag.kv.map.has(key), false);
  const forged = await post('/nest-ownership/confirm', { token: 'ab'.repeat(32) }, bag);
  assert.equal(forged.status, 403);
  assert.equal(bag.binds.length, 0);
});

test('a failed delivery does not leave a usable token or an ownership row', async () => {
  const bag = harness({
    user: member,
    records: { [nestId]: { email: member.email } },
    mailOk: false,
  });
  const response = await post('/nest-ownership/request', { nestId }, bag);
  assert.equal(response.body.message, RECOVERY_MESSAGE);
  assert.equal(bag.binds.length, 0);
  assert.equal([...bag.kv.map.keys()].some((key) => key.startsWith('ownrec:')), false);
});

test('repeated requests are limited and an interrupted confirmation can still finish', async () => {
  const bag = harness({
    user: member,
    records: { [nestId]: { email: member.email } },
  });
  for (let i = 0; i < 3; i += 1) await post('/nest-ownership/request', { nestId }, bag);
  const blocked = await post('/nest-ownership/request', { nestId }, bag);
  assert.equal(blocked.status, 429);
  assert.equal(bag.sent.length, 3);
  const token = recoveryToken(bag.sent[0].url);
  const done = await post('/nest-ownership/confirm', { token }, bag);
  assert.equal(done.status, 200);
  assert.equal(bag.binds.length, 1);
  assert.equal(recoveryLimited([now, now, now], now), true);
});

test('two confirms of one token bind one row, and a conflict does not replace an owner', async () => {
  const bag = harness({
    user: member,
    records: { [nestId]: { email: member.email } },
    association: () => 'conflict',
  });
  await post('/nest-ownership/request', { nestId }, bag);
  assert.equal(bag.sent.length, 0);
  const open = harness({
    user: member,
    records: { [nestId]: { email: member.email } },
  });
  await post('/nest-ownership/request', { nestId }, open);
  const token = recoveryToken(open.sent[0].url);
  const [first, second] = await Promise.all([
    post('/nest-ownership/confirm', { token }, open),
    post('/nest-ownership/confirm', { token }, open),
  ]);
  assert.equal([first, second].some((item) => item.status === 200), true);
  assert.equal(open.binds.every((row) => row.email === member.email && row.id === nestId), true);
  const third = await post('/nest-ownership/confirm', { token }, open);
  assert.equal(third.status, 403);
});

test('a confirmed email change between request and redemption grants nothing', async () => {
  const session = { ...member };
  const bag = harness({
    user: session,
    records: { [nestId]: { email: member.email } },
  });
  await post('/nest-ownership/request', { nestId }, bag);
  const token = recoveryToken(bag.sent[0].url);
  session.email = 'changed@example.com';
  session.email_change = member.email;
  const changed = await post('/nest-ownership/confirm', { token, email: member.email }, bag);
  assert.equal(changed.status, 403);
  assert.equal(bag.binds.length, 0);
  assert.equal([...bag.kv.map.keys()].some((key) => key.startsWith('ownrec:')), true);
  session.email = member.email;
  session.email_confirmed_at = null;
  session.confirmed_at = null;
  const unconfirmed = await post('/nest-ownership/confirm', { token }, bag);
  assert.equal(unconfirmed.status, 403);
  assert.equal(bag.binds.length, 0);
});

test('overlapping redemptions stay on the token user, assessment, and email', async () => {
  const gate = {};
  gate.promise = new Promise((resolve) => { gate.release = resolve; });
  let reads = 0;
  const kv = memoryKv();
  const originalGet = kv.get.bind(kv);
  kv.get = async (key) => {
    const value = await originalGet(key);
    if (String(key).startsWith('ownrec:') && value) {
      reads += 1;
      if (reads === 2) gate.release();
      await gate.promise;
    }
    return originalGet(key);
  };
  const open = harness({
    user: member,
    kv,
    records: { [nestId]: { email: member.email } },
  });
  await post('/nest-ownership/request', { nestId }, open);
  const token = recoveryToken(open.sent[0].url);
  const intruder = harness({
    user: other,
    kv,
    records: { [nestId]: { email: member.email } },
    owners: open.owners,
  });
  const [first, second] = await Promise.all([
    post('/nest-ownership/confirm', { token, email: other.email, nestId: 'nest-other-assessment' }, open),
    post('/nest-ownership/confirm', { token, email: other.email, userId: other.id }, intruder),
  ]);
  assert.equal(first.status, 200);
  assert.equal(first.body.nestId, nestId);
  assert.equal(second.status, 403);
  assert.equal(open.binds.length, 1);
  assert.equal(intruder.binds.length, 0);
  assert.equal(open.owners.get(nestId), member.email);
  const again = await post('/nest-ownership/confirm', { token }, open);
  assert.equal(again.status, 403);
});

test('a confirmation that loses the ownership row does not report success', async () => {
  const bag = harness({
    user: member,
    records: { [nestId]: { email: member.email } },
    owners: new Map([[nestId, 'already-bound@example.com']]),
  });
  await post('/nest-ownership/request', { nestId }, bag);
  const token = recoveryToken(bag.sent[0].url);
  const lost = await post('/nest-ownership/confirm', { token }, bag);
  assert.equal(lost.status, 403);
  assert.equal(bag.owners.get(nestId), 'already-bound@example.com');
  assert.equal(JSON.stringify(lost.body).includes('already-bound@example.com'), false);
});

test('the pages offer confirmation without asking for an email address', () => {
  const compass = readFileSync(new URL('../inner-compass/index.html', import.meta.url), 'utf8');
  const nest = readFileSync(new URL('./nest-client.js', import.meta.url), 'utf8');
  const adapter = readFileSync(new URL('./ownership-recovery-worker.js', import.meta.url), 'utf8');
  const worker = readFileSync("/Users/lukehaythorpe/Library/Mobile Documents/com~apple~CloudDocs/_LLC Buisiness Files/Lil' Bird/lilbird site/Deep-profile Cursor Project/lilbird-assessment.js", 'utf8');
  const gtm = readFileSync(new URL('../lilbird-gtm.js', import.meta.url), 'utf8');
  const head = compass.slice(0, compass.indexOf('/lilbird-gtm.js'));
  const strip = head.slice(head.indexOf('referrer'), head.indexOf('lilbird-theme'));
  assert.match(compass, /Send a confirmation/);
  assert.match(compass, /\/nest-ownership\/request/);
  assert.match(head, /strict-origin-when-cross-origin/);
  assert.match(strip, /params\.delete\('recover'\)/);
  assert.match(strip, /hashchange/);
  assert.doesNotMatch(strip, /localStorage|sessionStorage/);
  assert.match(gtm, /'recover'/);
  assert.match(nest, /\/nest-ownership\/request/);
  const authFn = worker.slice(worker.indexOf('async function getAuthUser'), worker.indexOf('function isUuid'));
  assert.match(authFn, /\/auth\/v1\/user/);
  assert.match(authFn, /email_confirmed_at/);
  assert.doesNotMatch(authFn, /email_change/);
  assert.match(worker, /getUser: getAuthUser/);
  assert.match(worker, /routeOwnershipRecovery/);
  assert.match(worker, /const WORKER_VERSION = 'v8\.7\.0-release-b3'/);
  assert.match(worker, /resolution=ignore-duplicates/);
  assert.match(worker, /select=email/);
  assert.doesNotMatch(adapter, /user_entitlements|console\.|body\.email|body\.userId|email_change/);
  assert.match(adapter, /storedOwner !== decision\.email/);
  assert.equal(confirmUrl('abc').includes('email='), false);
  assert.equal(new URL(confirmUrl('abc')).search, '');
  assert.match(confirmUrl('abc'), /#recover=abc$/);
  const record = recoveryRecord({ userId: member.id, nestId, now });
  const consumed = recoveryConsumeDecision({
    record,
    user: member,
    storedEmail: member.email,
    now,
  });
  assert.equal(consumed.ok, true);
  assert.equal(consumed.body.profile, undefined);
});
