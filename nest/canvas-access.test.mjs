import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  applyCanvasWrite,
  canvasAccessDecision,
  canvasDenial,
  claimDecision,
  newCanvasToken,
} from './canvas-access.js';

const owner = { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.com' };
const other = { id: '22222222-2222-4222-8222-222222222222', email: 'other@example.com' };

test('a nest id alone cannot read or write a canvas', () => {
  const token = newCanvasToken();
  const recordToken = token;
  const anon = canvasAccessDecision({
    user: null,
    owned: false,
    token: '',
    recordToken,
    recordExists: true,
  });
  assert.equal(anon.allow, false);
  assert.equal(anon.status, 401);
  assert.deepEqual(canvasDenial(anon), { error: 'Please log in.' });
  assert.equal(JSON.stringify(canvasDenial(anon)).includes('canvas'), false);

  const wrongToken = canvasAccessDecision({
    user: null,
    owned: false,
    token: newCanvasToken(),
    recordToken,
    recordExists: true,
  });
  assert.equal(wrongToken.status, 401);

  const stranger = canvasAccessDecision({
    user: other,
    owned: false,
    token,
    recordToken,
    recordExists: true,
  });
  assert.equal(stranger.allow, false);
  assert.equal(stranger.status, 403);
  assert.deepEqual(canvasDenial(stranger), { error: 'Not allowed' });

  const signedInOwner = canvasAccessDecision({
    user: owner,
    owned: true,
    token: '',
    recordToken,
    recordExists: true,
  });
  assert.equal(signedInOwner.allow, true);
  assert.equal(signedInOwner.via, 'owner');

  const creatingSession = canvasAccessDecision({
    user: null,
    owned: false,
    token,
    recordToken,
    recordExists: true,
  });
  assert.equal(creatingSession.allow, true);
  assert.equal(creatingSession.via, 'session');
});

test('a canvas write cannot replace the bound email', () => {
  const first = applyCanvasWrite(
    { email: '', canvasScores: { why: 1 }, profile: { private: true }, canvasToken: 'kept' },
    { email: 'owner@example.com', canvasScores: { why: 9 }, canvasHistory: [{ date: 'a', scores: { why: 9 } }] },
  );
  assert.equal(first.emailToBind, 'owner@example.com');
  assert.equal(first.record.email, 'owner@example.com');
  assert.equal(first.record.canvasScores.why, 9);
  assert.equal(first.record.profile.private, true);
  assert.equal(first.record.canvasToken, 'kept');

  const replaced = applyCanvasWrite(first.record, {
    email: 'other@example.com',
    canvasScores: { why: 2 },
  });
  assert.equal(replaced.emailToBind, null);
  assert.equal(replaced.record.email, 'owner@example.com');
  assert.equal(replaced.record.canvasScores.why, 2);
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
