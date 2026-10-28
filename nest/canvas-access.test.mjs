import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CANVAS_CAPABILITY_TTL_MS,
  applyCanvasWrite,
  bridgeProfileDecision,
  canvasAccessDecision,
  canvasDenial,
  capabilityStillValid,
  claimDecision,
  courseLinkDecision,
  issueCanvasCapability,
  mayRecordOwnerEmail,
  newCanvasToken,
  partnerProfileDecision,
  retakeDecision,
} from './canvas-access.js';

const owner = { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.com' };
const other = { id: '22222222-2222-4222-8222-222222222222', email: 'other@example.com' };
const now = Date.parse('2026-10-28T18:00:00.000Z');
const soon = new Date(now + 60 * 1000).toISOString();
const later = new Date(now + CANVAS_CAPABILITY_TTL_MS).toISOString();
const expired = new Date(now - 1000).toISOString();

function decide(overrides) {
  return canvasAccessDecision({
    user: null,
    ownership: null,
    token: '',
    recordToken: 'a'.repeat(64),
    tokenExpires: soon,
    now,
    recordExists: true,
    ...overrides,
  });
}

test('canvas tokens are unpredictable capability secrets with an explicit expiry', () => {
  const first = issueCanvasCapability(now);
  const second = issueCanvasCapability(now);
  assert.notEqual(first.canvasToken, second.canvasToken);
  assert.equal(first.canvasToken.length, 64);
  assert.equal(newCanvasToken().length, 64);
  assert.equal(first.canvasTokenExpires, later);
  assert.equal(CANVAS_CAPABILITY_TTL_MS, 2 * 60 * 60 * 1000);
  assert.equal(capabilityStillValid(soon, now), true);
  assert.equal(capabilityStillValid(expired, now), false);
  assert.equal(capabilityStillValid(new Date(now).toISOString(), now), false);
  assert.equal(capabilityStillValid('', now), false);
  assert.equal(capabilityStillValid('not-a-date', now), false);
});

test('a capability can be presented again before it expires and cannot open another assessment', () => {
  const token = newCanvasToken();
  const firstUse = decide({ token, recordToken: token, tokenExpires: soon });
  const reuse = decide({ token, recordToken: token, tokenExpires: soon });
  assert.equal(firstUse.allow, true);
  assert.equal(firstUse.via, 'capability');
  assert.equal(reuse.allow, true);
  assert.equal(reuse.via, 'capability');

  const stale = decide({ token, recordToken: token, tokenExpires: expired });
  assert.equal(stale.allow, false);
  assert.equal(stale.status, 401);

  const missingExpiry = decide({ token, recordToken: token, tokenExpires: '' });
  assert.equal(missingExpiry.allow, false);

  const otherAssessment = decide({ token, recordToken: newCanvasToken(), tokenExpires: soon });
  assert.equal(otherAssessment.allow, false);
  assert.equal(otherAssessment.status, 401);

  const invalid = decide({ token: 'short', recordToken: 'short', tokenExpires: soon });
  assert.equal(invalid.allow, false);
});

test('a nest id alone cannot read or write a canvas, and a token cannot override a signed-in non-owner', () => {
  const token = newCanvasToken();
  const anon = decide({ token: '', recordToken: token });
  assert.equal(anon.allow, false);
  assert.equal(anon.status, 401);
  assert.deepEqual(canvasDenial(anon), { error: 'Please log in.' });
  assert.equal(JSON.stringify(canvasDenial(anon)).includes('canvas'), false);
  assert.equal(JSON.stringify(canvasDenial(anon)).includes('@'), false);

  const wrongToken = decide({ token: newCanvasToken(), recordToken: token });
  assert.equal(wrongToken.status, 401);

  const stranger = decide({
    user: other,
    ownership: null,
    token,
    recordToken: token,
    tokenExpires: soon,
  });
  assert.equal(stranger.allow, false);
  assert.equal(stranger.status, 403);
  assert.deepEqual(canvasDenial(stranger), { error: 'Not allowed' });

  for (const ownership of ['link', 'read', 'email']) {
    const signedInOwner = decide({ user: owner, ownership, token: '' });
    assert.equal(signedInOwner.allow, true);
    assert.equal(signedInOwner.via, 'owner');
    assert.equal(signedInOwner.ownership, ownership);
  }

  const missing = decide({ user: owner, ownership: 'link', recordExists: false });
  assert.equal(missing.status, 404);
});

test('email match can read and cannot create a stronger ownership record', () => {
  const emailRead = decide({ user: owner, ownership: 'email', token: '' });
  const link = decide({ user: owner, ownership: 'link', token: '' });
  const read = decide({ user: owner, ownership: 'read', token: '' });
  const capability = decide({ token: 'b'.repeat(64), recordToken: 'b'.repeat(64) });
  assert.equal(mayRecordOwnerEmail(emailRead), false);
  assert.equal(mayRecordOwnerEmail(link), true);
  assert.equal(mayRecordOwnerEmail(read), true);
  assert.equal(mayRecordOwnerEmail(capability), true);
  assert.equal(mayRecordOwnerEmail(decide({ token: '' })), false);
  assert.equal(mayRecordOwnerEmail({ allow: true, via: 'owner', ownership: 'email' }), false);
});

test('a course launch token cannot attach an arbitrary assessment', () => {
  const capability = { allow: true, via: 'capability', ownership: null };
  const linked = { allow: true, via: 'owner', ownership: 'link' };
  const emailOnly = { allow: true, via: 'owner', ownership: 'email' };
  const denied = { allow: false, status: 403, error: 'Not allowed' };

  assert.equal(courseLinkDecision({
    launchValid: true,
    access: denied,
    boundEmail: '',
    courseUserEmail: 'member@example.com',
  }).status, 403);

  assert.equal(courseLinkDecision({
    launchValid: false,
    access: capability,
    boundEmail: '',
    courseUserEmail: 'member@example.com',
  }).allow, false);

  assert.equal(courseLinkDecision({
    launchValid: true,
    access: capability,
    boundEmail: '',
    courseUserEmail: 'member@example.com',
  }).allow, true);

  assert.equal(courseLinkDecision({
    launchValid: true,
    access: capability,
    boundEmail: 'member@example.com',
    courseUserEmail: 'member@example.com',
  }).allow, true);

  assert.equal(courseLinkDecision({
    launchValid: true,
    access: capability,
    boundEmail: 'owner@example.com',
    courseUserEmail: 'member@example.com',
  }).status, 403);

  assert.equal(courseLinkDecision({
    launchValid: true,
    access: linked,
    boundEmail: 'member@example.com',
    courseUserEmail: 'member@example.com',
  }).allow, true);

  assert.equal(courseLinkDecision({
    launchValid: true,
    access: emailOnly,
    boundEmail: 'member@example.com',
    courseUserEmail: 'member@example.com',
  }).status, 403);

  assert.equal(courseLinkDecision({
    launchValid: true,
    access: linked,
    boundEmail: 'owner@example.com',
    courseUserEmail: 'member@example.com',
  }).status, 403);
});

test('a paid retake requires a strong owner and does not accept an email-only match', () => {
  const denied = decide({ user: other, ownership: null, token: 'c'.repeat(64), recordToken: 'c'.repeat(64) });
  assert.equal(retakeDecision(denied).allow, false);
  assert.equal(retakeDecision(denied).status, 403);

  const emailOnly = decide({ user: owner, ownership: 'email' });
  assert.equal(retakeDecision(emailOnly).status, 403);

  const capability = decide({ token: 'd'.repeat(64), recordToken: 'd'.repeat(64) });
  assert.equal(retakeDecision(capability).allow, true);
  assert.equal(retakeDecision(decide({ user: owner, ownership: 'link' })).allow, true);
  assert.equal(retakeDecision(decide({ user: owner, ownership: 'read' })).allow, true);
  assert.equal(retakeDecision({ allow: false, status: 401, error: 'Please log in.' }).status, 401);
});

test('Nest Plus does not authorize another member profile', () => {
  const stranger = decide({ user: other, ownership: null });
  const bypass = partnerProfileDecision({
    access: stranger,
    callerHasNestPlus: true,
    recordHasNestPlus: true,
  });
  assert.equal(bypass.allow, false);
  assert.equal(bypass.error, 'Not allowed');

  const own = decide({ user: owner, ownership: 'link' });
  assert.equal(partnerProfileDecision({
    access: own,
    callerHasNestPlus: false,
    recordHasNestPlus: false,
  }).error, 'nest_plus_required');
  assert.equal(partnerProfileDecision({
    access: own,
    callerHasNestPlus: true,
    recordHasNestPlus: false,
  }).allow, true);
  assert.equal(partnerProfileDecision({
    access: own,
    callerHasNestPlus: false,
    recordHasNestPlus: true,
  }).allow, true);
});

test('Bridge accepts a submitted profile and refuses a stored profile without access', () => {
  const submitted = bridgeProfileDecision({
    access: { allow: false, status: 401, error: 'Please log in.' },
    suppliedProfile: { mbti: 'INTJ' },
  });
  assert.equal(submitted.allow, true);
  assert.equal(submitted.via, 'submitted');

  const stored = bridgeProfileDecision({
    access: { allow: false, status: 401, error: 'Please log in.' },
    suppliedProfile: null,
  });
  assert.equal(stored.allow, false);
  assert.equal(stored.status, 401);

  const owned = bridgeProfileDecision({
    access: decide({ user: owner, ownership: 'link' }),
    suppliedProfile: null,
  });
  assert.equal(owned.allow, true);

  const arrayIsNotConsent = bridgeProfileDecision({
    access: null,
    suppliedProfile: [{ mbti: 'INTJ' }],
  });
  assert.equal(arrayIsNotConsent.allow, false);
});

test('a canvas write cannot replace the bound email or move the capability expiry', () => {
  const first = applyCanvasWrite(
    {
      email: '',
      canvasScores: { why: 1 },
      profile: { private: true },
      canvasToken: 'kept',
      canvasTokenExpires: soon,
    },
    { email: 'owner@example.com', canvasScores: { why: 9 }, canvasHistory: [{ date: 'a', scores: { why: 9 } }] },
  );
  assert.equal(first.emailToBind, 'owner@example.com');
  assert.equal(first.record.email, 'owner@example.com');
  assert.equal(first.record.canvasScores.why, 9);
  assert.equal(first.record.profile.private, true);
  assert.equal(first.record.canvasToken, 'kept');
  assert.equal(first.record.canvasTokenExpires, soon);

  const saved = {
    ...first.record,
    updatedAt: '2026-10-28T20:00:00.000Z',
  };
  assert.equal(saved.canvasTokenExpires, soon);

  const replaced = applyCanvasWrite(first.record, {
    email: 'other@example.com',
    canvasScores: { why: 2 },
    canvasTokenExpires: later,
  });
  assert.equal(replaced.emailToBind, null);
  assert.equal(replaced.record.email, 'owner@example.com');
  assert.equal(replaced.record.canvasScores.why, 2);
  assert.equal(replaced.record.canvasTokenExpires, soon);
});

test('an unrelated account cannot claim Inner Compass, and a matching account can', () => {
  const anon = claimDecision({ user: null, boundEmail: 'owner@example.com' });
  assert.equal(anon.status, 401);
  const stranger = claimDecision({ user: other, boundEmail: 'owner@example.com' });
  assert.equal(stranger.status, 403);
  const unbound = claimDecision({ user: owner, boundEmail: '' });
  assert.equal(unbound.status, 403);
  const same = claimDecision({ user: owner, boundEmail: 'owner@example.com' });
  assert.equal(same.allow, true);
  assert.equal(claimDecision({ user: owner, boundEmail: 'Owner@Example.com' }).allow, true);
});

test('the claim migration refuses a nest id and does not revoke entitlements', () => {
  const sql = readFileSync(new URL('./release-a-claim.sql', import.meta.url), 'utf8');
  assert.match(sql, /v_bound <> v_caller/);
  assert.match(sql, /raise exception 'not allowed'/);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.user_entitlements/i);
  assert.doesNotMatch(sql, /active\s*=\s*false/i);
  assert.match(sql, /Do not run this until the reviewed worker is deployed/);
});

test('the assessment worker wires every private route through the same decisions', () => {
  const workerPath = "/Users/lukehaythorpe/Library/Mobile Documents/com~apple~CloudDocs/_LLC Buisiness Files/Lil' Bird/lilbird site/Deep-profile Cursor Project/lilbird-assessment.js";
  const worker = readFileSync(workerPath, 'utf8');
  assert.match(worker, /const WORKER_VERSION = 'v8\.5\.1-release-a'/);
  assert.doesNotMatch(worker, /function bridgeLoadNest/);

  const linkFn = worker.slice(
    worker.indexOf('async function handleLinkToCourse'),
    worker.indexOf('function nestIdFromCustomFields'),
  );
  assert.ok(linkFn.indexOf('courseLinkDecision') > 0);
  assert.ok(linkFn.indexOf('courseLinkDecision') < linkFn.indexOf("rest/v1/deep_profile_links"));
  assert.match(linkFn, /link-to-course refused/);

  const retakeFn = worker.slice(
    worker.indexOf('async function inheritPaidRetake'),
    worker.indexOf('function canSetEmail'),
  );
  assert.ok(retakeFn.indexOf('retakeDecision') < retakeFn.indexOf('paidRetakesUsed'));
  assert.ok(retakeFn.indexOf('if (!decision.allow) return') < retakeFn.indexOf('root.paidRetakesUsed'));
  assert.match(retakeFn, /preservedExpiry = root\.canvasTokenExpires/);

  const partnerFn = worker.slice(
    worker.indexOf('async function handlePartnerDynamic'),
    worker.indexOf('async function handleStoreProfile'),
  );
  assert.ok(partnerFn.indexOf('decideCanvasAccess') < partnerFn.indexOf('profileForPrompt = record.profile'));
  assert.match(partnerFn, /recordHasNestPlus: record\.nestPlus === true/);
  assert.doesNotMatch(partnerFn, /record\.paid === true/);

  const createFn = worker.slice(
    worker.indexOf('async function handleBridgeCoupleCreate'),
    worker.indexOf('async function handleBridgeCoupleJoin'),
  );
  const joinFn = worker.slice(
    worker.indexOf('async function handleBridgeCoupleJoin'),
    worker.indexOf('async function handleBridgeCoupleStatus'),
  );
  assert.match(createFn, /bridgeProfileForRequest/);
  assert.match(joinFn, /bridgeProfileForRequest/);
  assert.doesNotMatch(createFn, /bridgeLoadNest/);
  assert.doesNotMatch(joinFn, /bridgeLoadNest/);

  for (const name of [
    'handleGetProfile',
    'handleStoreProfile',
    'handleCheckPaid',
    'handleLeadUnlock',
    'handleSendProfileEmail',
    'handleGetNestPreferences',
    'handleNestPreferences',
  ]) {
    const start = worker.indexOf(`async function ${name}`);
    assert.ok(start > 0, name);
    const slice = worker.slice(start, start + 1800);
    assert.match(slice, /decideCanvasAccess/);
  }

  assert.match(worker, /The KV lifetime refreshes with the read\. canvasTokenExpires does not\./);
  assert.match(worker, /issueCanvasCapability/);
});
