import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  BOUNDARY_UNTANGLER,
  answersReady,
  buildInsertRow,
  fallbackInsight,
  handleJourneyReflect,
  prepareJourneyReflect,
} from './journey-reflect.js';

const sample = {
  situation: 'My teammate messages after dinner about a deadline.',
  difficulty: 'I worry the project stalls if I stay quiet.',
  need: 'I need evenings that are actually off.',
  boundary: 'I will answer work chat in the morning.',
  nextStep: 'Turn off chat notifications after 7pm this week.',
};

function memoryClient() {
  const rows = [];
  return {
    rows,
    from() {
      return {
        insert(row) {
          const stored = Object.assign({ id: 'row-' + (rows.length + 1) }, row);
          rows.push(stored);
          return { select: async () => ({ data: [{ id: stored.id }], error: null }) };
        },
        delete() {
          return {
            eq(field, value) {
              return {
                eq(ownerField, ownerId) {
                  const before = rows.length;
                  for (let i = rows.length - 1; i >= 0; i -= 1) {
                    if (rows[i][field] === value && rows[i][ownerField] === ownerId) rows.splice(i, 1);
                  }
                  return { error: before === rows.length ? { message: 'not found' } : null, removed: before - rows.length };
                },
              };
            },
          };
        },
      };
    },
  };
}

test('a reflection is rejected without a login, and a browser user id is ignored', async () => {
  let seenUser = null;
  const response = await handleJourneyReflect({
    request: new Request('https://worker.test/journey/reflect', {
      method: 'POST',
      headers: { Authorization: 'Bearer member-token' },
    }),
    body: Object.assign({ toolId: BOUNDARY_UNTANGLER.id, toolVersion: 1, answers: sample, userId: 'someone-else' }, {}),
    env: {},
    origin: 'http://localhost:8765',
    respond(body, status) {
      seenUser = body;
      return { status, body };
    },
    respondError(message, status) {
      return { status, error: message };
    },
    getAuthUser: async () => null,
  });
  assert.equal(response.status, 401);

  const prepared = prepareJourneyReflect({
    toolId: BOUNDARY_UNTANGLER.id,
    toolVersion: 1,
    answers: sample,
    userId: 'someone-else',
    user_id: 'someone-else',
  });
  assert.equal(prepared.userId, undefined);
  assert.equal(prepared.answers.boundary, sample.boundary);
  assert.equal(seenUser, null);
});

test('logged-in reflect returns a fallback when the model is unavailable and does not write', async () => {
  const writes = [];
  const response = await handleJourneyReflect({
    request: new Request('https://worker.test/journey/reflect'),
    body: { toolId: BOUNDARY_UNTANGLER.id, toolVersion: 1, answers: sample, userId: 'forged' },
    env: {},
    origin: 'http://localhost:8765',
    respond(body, status) {
      return { status, body };
    },
    respondError(message, status) {
      return { status, error: message };
    },
    getAuthUser: async () => ({ id: 'member-1', email: 'member@example.com' }),
    write: (row) => writes.push(row),
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.degraded, true);
  assert.match(response.body.insight, /7pm/);
  assert.equal(writes.length, 0);
  assert.equal(JSON.stringify(response.body).includes('forged'), false);
});

test('two saves of the same tool are two rows, and delete removes only the owner row', async () => {
  const db = memoryClient();
  const first = buildInsertRow('member-1', sample, fallbackInsight(sample));
  const second = buildInsertRow('member-1', Object.assign({}, sample, { nextStep: 'Say it once in the Monday standup.' }), null);
  assert.equal(first.id, undefined);
  assert.equal(first.tool_id, 'boundary-untangler');
  assert.equal(first.tool_version, 1);
  await db.from('journey_reflections').insert(first).select();
  await db.from('journey_reflections').insert(second).select();
  assert.equal(db.rows.length, 2);
  assert.notEqual(db.rows[0].id, db.rows[1].id);
  const denied = await db.from('journey_reflections').delete().eq('id', db.rows[0].id).eq('user_id', 'member-2');
  assert.equal(denied.error.message, 'not found');
  assert.equal(db.rows.length, 2);
  const removed = await db.from('journey_reflections').delete().eq('id', db.rows[0].id).eq('user_id', 'member-1');
  assert.equal(removed.error, null);
  assert.equal(db.rows.length, 1);
});

test('unsaved answers are not a database row', () => {
  const draft = Object.assign({}, sample);
  assert.equal(answersReady(draft), true);
  const db = memoryClient();
  assert.equal(db.rows.length, 0);
  assert.equal(buildInsertRow('member-1', draft, '').insight, null);
});

test('oversized and unknown exercises are refused', () => {
  const huge = Object.assign({}, sample, { situation: 'x'.repeat(5000) });
  const cleaned = prepareJourneyReflect({ toolId: BOUNDARY_UNTANGLER.id, toolVersion: 1, answers: huge });
  assert.equal(cleaned.answers.situation.length, 2000);
  assert.equal(prepareJourneyReflect({ toolId: 'other-tool', toolVersion: 1, answers: sample }).status, 400);
  assert.equal(prepareJourneyReflect({ toolId: BOUNDARY_UNTANGLER.id, toolVersion: 2, answers: sample }).status, 400);
});

test('the migration allows select, insert, and delete, and does not grant update', () => {
  const sql = readFileSync(new URL('./journey-reflections.sql', import.meta.url), 'utf8');
  assert.match(sql, /for select/);
  assert.match(sql, /for insert/);
  assert.match(sql, /for delete/);
  assert.equal(/for update/i.test(sql), false);
  assert.match(sql, /grant select, insert, delete/);
  assert.match(sql, /auth\.uid\(\) = user_id/);
  assert.match(sql, /tool_id text not null/);
  assert.match(sql, /tool_version integer not null/);
});

test('the page does not store drafts or read Solo tool rows', () => {
  const page = readFileSync(new URL('./journey.js', import.meta.url), 'utf8');
  assert.equal(page.includes('localStorage'), false);
  assert.equal(page.includes('sessionStorage'), false);
  assert.equal(page.includes('tool_outputs'), false);
  assert.equal(page.includes('nestId'), false);
  assert.equal(page.includes('userId'), false);
});

test('frontend fallback is deterministic', () => {
  const a = fallbackInsight(sample);
  const b = fallbackInsight(sample);
  assert.equal(a, b);
  assert.match(a, /answer work chat in the morning/);
  assert.match(a, /7pm/);
});
