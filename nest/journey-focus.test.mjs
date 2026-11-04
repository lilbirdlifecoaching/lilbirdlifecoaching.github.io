import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOCUS_MISSING_STATUS,
  hasNextStep,
  normalizeReflectionId,
  pickLatestNextStep,
  resolveFocusReflection,
} from './journey-focus.js';

const ID_NEW = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2';
const ID_OLD = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
const ID_OTHER = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const rows = [
  { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', next_step: null, created_at: '2026-03-01', answers: { mood: 'ok' } },
  { id: ID_NEW, next_step: 'Write the letter this weekend.', created_at: '2026-02-20' },
  { id: ID_OLD, next_step: 'Turn off chat after 7pm.', created_at: '2026-02-01' },
];

test('normalizeReflectionId accepts uuids and rejects junk', () => {
  assert.equal(normalizeReflectionId(ID_NEW), ID_NEW);
  assert.equal(normalizeReflectionId('  ' + ID_NEW.toUpperCase() + '  '), ID_NEW);
  assert.equal(normalizeReflectionId('../secret'), '');
  assert.equal(normalizeReflectionId("1'; DROP TABLE journey_reflections;--"), '');
  assert.equal(normalizeReflectionId('r1'), '');
  assert.equal(normalizeReflectionId(''), '');
  assert.equal(normalizeReflectionId(null), '');
  assert.equal(normalizeReflectionId('a'.repeat(80)), '');
});

test('hasNextStep reads column and answers.nextStep', () => {
  assert.equal(hasNextStep({ next_step: 'Go for a walk' }), true);
  assert.equal(hasNextStep({ next_step: '  ', answers: { nextStep: 'Call mom' } }), true);
  assert.equal(hasNextStep({ next_step: null, answers: {} }), false);
  assert.equal(hasNextStep(null), false);
});

test('pickLatestNextStep returns newest row with a next step', () => {
  assert.equal(pickLatestNextStep(rows).id, ID_NEW);
  assert.equal(pickLatestNextStep([{ id: ID_OTHER, next_step: null }]), null);
  assert.equal(pickLatestNextStep(null), null);
});

test('resolveFocusReflection finds the stable id', () => {
  const found = resolveFocusReflection(rows, ID_OLD);
  assert.equal(found.status, 'found');
  assert.equal(found.reflection.next_step, 'Turn off chat after 7pm.');
});

test('resolveFocusReflection reports missing for inaccessible foreign ids', () => {
  // Caller only ever passes their own RLS-filtered rows; a foreign uuid is indistinguishable from deleted.
  const missing = resolveFocusReflection(rows, ID_OTHER);
  assert.equal(missing.status, 'missing');
  assert.equal(missing.reflection, null);
  assert.ok(FOCUS_MISSING_STATUS.includes('no longer'));
});

test('resolveFocusReflection reports invalid for malformed ids', () => {
  assert.equal(resolveFocusReflection(rows, '../etc/passwd').status, 'invalid');
  assert.equal(resolveFocusReflection(rows, '<script>').status, 'invalid');
  assert.equal(resolveFocusReflection(rows, 'not-a-uuid').status, 'invalid');
});

test('resolveFocusReflection reports none without an id', () => {
  assert.equal(resolveFocusReflection(rows, '').status, 'none');
  assert.equal(resolveFocusReflection(rows, null).status, 'none');
});
