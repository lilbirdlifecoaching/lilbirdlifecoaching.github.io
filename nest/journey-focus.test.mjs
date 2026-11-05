import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHECKIN_RESPONSES,
  FOCUS_MISSING_STATUS,
  NOTE_MAX,
  clipCheckinNote,
  hasNextStep,
  normalizeReflectionId,
  pickLatestNextStep,
  resolveActiveFocus,
  resolveFocusReflection,
  sortCheckinsNewestFirst,
} from './journey-focus.js';

const R1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
const R2 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2';
const R3 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3';
const OTHER = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const reflections = [
  { id: R3, next_step: null, created_at: '2026-03-01T00:00:00Z' },
  { id: R2, next_step: 'Write the letter this weekend.', created_at: '2026-02-20T00:00:00Z' },
  { id: R1, next_step: 'Turn off chat after 7pm.', created_at: '2026-02-01T00:00:00Z' },
];

function event(partial) {
  return Object.assign(
    {
      id: 'cccccccc-cccc-cccc-cccc-ccccccccccc1',
      created_at: '2026-02-21T00:00:00Z',
      response: CHECKIN_RESPONSES.STILL_WORKING,
      reflection_id: R2,
    },
    partial
  );
}

test('normalizeReflectionId accepts uuids and rejects junk', () => {
  assert.equal(normalizeReflectionId(R2), R2);
  assert.equal(normalizeReflectionId('../secret'), '');
  assert.equal(normalizeReflectionId('not-a-uuid'), '');
});

test('hasNextStep and pickLatestNextStep legacy helpers', () => {
  assert.equal(hasNextStep(reflections[1]), true);
  assert.equal(pickLatestNextStep(reflections).id, R2);
  assert.equal(pickLatestNextStep([{ id: R1, next_step: null }]), null);
});

test('resolveFocusReflection ownership-safe statuses', () => {
  assert.equal(resolveFocusReflection(reflections, R1).status, 'found');
  assert.equal(resolveFocusReflection(reflections, OTHER).status, 'missing');
  assert.equal(resolveFocusReflection(reflections, '../x').status, 'invalid');
  assert.ok(FOCUS_MISSING_STATUS.includes('no longer'));
});

test('legacy members with no check-ins keep P2a newest next_step', () => {
  const focus = resolveActiveFocus(reflections, []);
  assert.equal(focus.status, 'active');
  assert.equal(focus.legacy, true);
  assert.equal(focus.reflection.id, R2);
});

test('took_step and still_working preserve focus', () => {
  const focus = resolveActiveFocus(reflections, [
    event({ response: CHECKIN_RESPONSES.TOOK_STEP, created_at: '2026-02-22T00:00:00Z', id: 'd0000000-0000-0000-0000-000000000002' }),
  ]);
  assert.equal(focus.status, 'active');
  assert.equal(focus.reflection.id, R2);
});

test('changed and done_for_now clear focus without resurrecting older steps', () => {
  const cleared = resolveActiveFocus(reflections, [
    event({
      response: CHECKIN_RESPONSES.DONE_FOR_NOW,
      created_at: '2026-02-23T00:00:00Z',
      id: 'd0000000-0000-0000-0000-000000000003',
      reflection_id: R2,
    }),
    event({
      response: CHECKIN_RESPONSES.STILL_WORKING,
      created_at: '2026-02-10T00:00:00Z',
      id: 'd0000000-0000-0000-0000-000000000001',
      reflection_id: R1,
    }),
  ]);
  assert.equal(cleared.status, 'resting');
  assert.equal(cleared.reflection, null);

  const changed = resolveActiveFocus(reflections, [
    event({ response: CHECKIN_RESPONSES.CHANGED, reflection_id: R2, created_at: '2026-02-24T00:00:00Z', id: 'd0000000-0000-0000-0000-000000000004' }),
  ]);
  assert.equal(changed.status, 'resting');
});

test('choose_again and activated set intentional focus', () => {
  const again = resolveActiveFocus(reflections, [
    event({
      response: CHECKIN_RESPONSES.CHOOSE_AGAIN,
      reflection_id: R1,
      created_at: '2026-02-25T00:00:00Z',
      id: 'd0000000-0000-0000-0000-000000000005',
    }),
  ]);
  assert.equal(again.status, 'active');
  assert.equal(again.reflection.id, R1);

  const activated = resolveActiveFocus(
    [{ id: R3, next_step: 'Sit outside for ten minutes.', created_at: '2026-03-02T00:00:00Z' }, ...reflections],
    [
      event({
        response: CHECKIN_RESPONSES.ACTIVATED,
        reflection_id: R3,
        created_at: '2026-03-02T00:00:01Z',
        id: 'd0000000-0000-0000-0000-000000000006',
      }),
      event({
        response: CHECKIN_RESPONSES.DONE_FOR_NOW,
        reflection_id: R2,
        created_at: '2026-02-23T00:00:00Z',
        id: 'd0000000-0000-0000-0000-000000000003',
      }),
    ]
  );
  assert.equal(activated.status, 'active');
  assert.equal(activated.reflection.id, R3);
});

test('orphaned newest event cannot reactivate historical reflections', () => {
  const focus = resolveActiveFocus(reflections, [
    event({
      response: CHECKIN_RESPONSES.TOOK_STEP,
      reflection_id: null,
      created_at: '2026-03-01T00:00:00Z',
      id: 'd0000000-0000-0000-0000-000000000007',
    }),
    event({
      response: CHECKIN_RESPONSES.STILL_WORKING,
      reflection_id: R1,
      created_at: '2026-02-10T00:00:00Z',
      id: 'd0000000-0000-0000-0000-000000000001',
    }),
  ]);
  assert.equal(focus.status, 'resting');
  assert.equal(focus.reflection, null);
});

test('event ordering is deterministic when created_at ties', () => {
  const sorted = sortCheckinsNewestFirst([
    event({ id: 'd0000000-0000-0000-0000-00000000000a', created_at: '2026-02-22T00:00:00Z', response: CHECKIN_RESPONSES.CHANGED, reflection_id: R2 }),
    event({ id: 'd0000000-0000-0000-0000-00000000000b', created_at: '2026-02-22T00:00:00Z', response: CHECKIN_RESPONSES.STILL_WORKING, reflection_id: R1 }),
  ]);
  assert.equal(sorted[0].id, 'd0000000-0000-0000-0000-00000000000b');
  const focus = resolveActiveFocus(reflections, sorted);
  assert.equal(focus.status, 'active');
  assert.equal(focus.reflection.id, R1);
});

test('clipCheckinNote enforces length and empty → null', () => {
  assert.equal(clipCheckinNote('  hello  '), 'hello');
  assert.equal(clipCheckinNote(''), null);
  assert.equal(clipCheckinNote('x'.repeat(NOTE_MAX + 40)).length, NOTE_MAX);
});

test('check-in load error does not revive legacy focus', () => {
  const focus = resolveActiveFocus(reflections, [], { checkinsError: true });
  assert.equal(focus.status, 'none');
  assert.equal(focus.error, true);
  assert.equal(focus.reflection, null);
});

test('example history matrix from the design', () => {
  let checkins = [];
  assert.equal(resolveActiveFocus(reflections, checkins).reflection.id, R2);

  checkins = [event({ response: CHECKIN_RESPONSES.STILL_WORKING, id: 'e1', created_at: '2026-02-21T01:00:00Z' })];
  assert.equal(resolveActiveFocus(reflections, checkins).reflection.id, R2);

  checkins = [
    event({ response: CHECKIN_RESPONSES.DONE_FOR_NOW, id: 'e2', created_at: '2026-02-22T01:00:00Z' }),
    ...checkins,
  ];
  assert.equal(resolveActiveFocus(reflections, checkins).status, 'resting');

  checkins = [
    event({ response: CHECKIN_RESPONSES.CHOOSE_AGAIN, reflection_id: R1, id: 'e3', created_at: '2026-02-23T01:00:00Z' }),
    ...checkins,
  ];
  assert.equal(resolveActiveFocus(reflections, checkins).reflection.id, R1);

  checkins = [
    event({ response: CHECKIN_RESPONSES.CHANGED, reflection_id: R1, id: 'e4', created_at: '2026-02-24T01:00:00Z' }),
    ...checkins,
  ];
  assert.equal(resolveActiveFocus(reflections, checkins).status, 'resting');
});
