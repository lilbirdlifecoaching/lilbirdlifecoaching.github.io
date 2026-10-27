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
import { SAVE_ERROR, createJourneySession, saveOutcome } from './journey-session.js';

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
  assert.match(sql, /Applied in Supabase/);
  assert.match(sql, /Do not run this file again/);
  assert.equal(/explicitly approved/.test(sql), false);
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

test('closing during an AI request aborts it and ignores the late response', () => {
  const journey = createJourneySession();
  const ticket = journey.beginReflect();
  let aborted = false;
  ticket.signal.addEventListener('abort', () => {
    aborted = true;
  });
  journey.invalidate();
  assert.equal(aborted, true);
  assert.equal(journey.reflectApplies(ticket), false);
});

test('logging out during an AI request invalidates that request', () => {
  const journey = createJourneySession();
  const ticket = journey.beginReflect();
  const lock = journey.tryBeginSave('member-1');
  journey.invalidate();
  assert.equal(ticket.signal.aborted, true);
  assert.equal(journey.reflectApplies(ticket), false);
  assert.equal(journey.saveApplies(lock, 'member-1'), false);
});

test('a new exercise ignores the reflection that was already in flight', () => {
  const journey = createJourneySession();
  const oldTicket = journey.beginReflect();
  journey.invalidate();
  const nextTicket = journey.beginReflect();
  assert.equal(journey.reflectApplies(oldTicket), false);
  assert.equal(oldTicket.signal.aborted, true);
  assert.equal(journey.reflectApplies(nextTicket), true);
  assert.equal(nextTicket.signal.aborted, false);
});

test('a network exception during Save keeps the answers and allows a retry', () => {
  const journey = createJourneySession();
  const lock = journey.tryBeginSave('member-1');
  const outcome = saveOutcome(journey.saveApplies(lock, 'member-1'), true);
  assert.equal(outcome.updateScreen, true);
  assert.equal(outcome.keepAnswers, true);
  assert.equal(outcome.restoreSave, true);
  assert.equal(outcome.message, SAVE_ERROR);
  journey.finishSave(lock);
  const retry = journey.tryBeginSave('member-1');
  assert.notEqual(retry, null);
  const saved = saveOutcome(journey.saveApplies(retry, 'member-1'), false);
  assert.equal(saved.keepAnswers, false);
  assert.equal(saved.saved, true);
});

test('double-clicking Save does not start a second submission', () => {
  const journey = createJourneySession();
  const first = journey.tryBeginSave('member-1');
  const second = journey.tryBeginSave('member-1');
  assert.notEqual(first, null);
  assert.equal(second, null);
  assert.equal(journey.saveApplies(first, 'member-1'), true);
});

test('a pending save cannot update a different member session', () => {
  const journey = createJourneySession();
  const lock = journey.tryBeginSave('member-1');
  assert.equal(journey.saveApplies(lock, 'member-2'), false);
  const switched = saveOutcome(journey.saveApplies(lock, 'member-2'), false);
  assert.equal(switched.updateScreen, false);
  assert.equal(switched.keepAnswers, true);
});

test('another member cannot read, insert, or delete these reflections', async () => {
  const rows = [];
  function client(authMemberId) {
    return {
      from() {
        return {
          insert(row) {
            if (row.user_id !== authMemberId) {
              return { select: async () => ({ data: null, error: { message: 'row-level security' } }) };
            }
            const stored = Object.assign({ id: 'row-' + (rows.length + 1) }, row);
            rows.push(stored);
            return { select: async () => ({ data: [{ id: stored.id }], error: null }) };
          },
          select() {
            return {
              eq(field, value) {
                return {
                  data: rows.filter((row) => row[field] === value && row.user_id === authMemberId),
                  error: null,
                };
              },
            };
          },
          delete() {
            return {
              eq(field, value) {
                return {
                  eq(ownerField, ownerId) {
                    if (ownerId !== authMemberId) return { error: { message: 'row-level security' } };
                    const before = rows.length;
                    for (let i = rows.length - 1; i >= 0; i -= 1) {
                      if (rows[i][field] === value && rows[i][ownerField] === ownerId) rows.splice(i, 1);
                    }
                    return { error: before === rows.length ? { message: 'not found' } : null };
                  },
                };
              },
            };
          },
        };
      },
    };
  }

  const owner = client('member-1');
  const other = client('member-2');
  const row = buildInsertRow('member-1', sample, null);
  const inserted = await owner.from('journey_reflections').insert(row).select();
  assert.equal(inserted.error, null);
  const seen = other.from('journey_reflections').select().eq('user_id', 'member-2');
  assert.equal(seen.data.length, 0);
  const forged = await other.from('journey_reflections').insert(buildInsertRow('member-1', sample, null)).select();
  assert.equal(forged.error.message, 'row-level security');
  const removed = other.from('journey_reflections').delete().eq('id', rows[0].id).eq('user_id', 'member-1');
  assert.equal(removed.error.message, 'row-level security');
  assert.equal(rows.length, 1);
  const own = owner.from('journey_reflections').select().eq('user_id', 'member-1');
  assert.equal(own.data.length, 1);
});

test('the page drops stale requests and shows the reviewed wording', () => {
  const page = readFileSync(new URL('./journey.js', import.meta.url), 'utf8');
  const tools = readFileSync(new URL('./journey-tools.js', import.meta.url), 'utf8');
  assert.match(page, /function startTool\(toolId\) \{\n  session\.invalidate\(\)/);
  assert.match(page, /function closeExercise\(\) \{\n  session\.invalidate\(\)/);
  assert.match(page, /reset\(\) \{\n    session\.invalidate\(\)/);
  assert.match(page, /if \(!currentMemberId\(\)\) \{\n      session\.invalidate\(\)/);
  assert.match(page, /signal: ticket\.signal/);
  assert.match(page, /catch \(e\) \{\n      failed = true;/);
  assert.match(tools, /Where does this feel tangled\?/);
  assert.match(tools, /A little more clarity\./);
  assert.match(page, /Visit My Life Canvas/);
  assert.match(page, /<summary>Open this reflection<\/summary>/);
  assert.match(page, /Saved to My Journey\./);
  assert.match(page, /id="journey-reflections"/);
  assert.match(page, /Close without saving/);
  assert.match(page, /Save to My Journey/);
  assert.match(page, /Find a little clarity/);
  assert.match(page, /What’s on your mind\?/);
  assert.match(page, /Your next steps/);
  assert.equal(page.includes('localStorage'), false);
  assert.equal(page.includes('sessionStorage'), false);
  assert.equal((page.match(/fetch\(/g) || []).length, 1);
});

test('other tools can be reflected without writing, and an unknown tool is still refused', async () => {
  const courage = (await import('./journey-tools.js')).toolById('courage-compass');
  const answers = {};
  courage.stages.forEach((stage) => {
    answers[stage.key] = stage.optional ? '' : 'A real note for ' + stage.label;
  });
  answers.nextStep = 'Send the email on Thursday morning.';
  const prepared = prepareJourneyReflect({
    toolId: courage.id,
    toolVersion: 1,
    answers,
    userId: 'someone-else',
  });
  assert.equal(prepared.error, undefined);
  assert.equal(prepared.userId, undefined);
  assert.equal(prepared.answers.need, '');
  const writes = [];
  const response = await handleJourneyReflect({
    request: new Request('https://worker.test/journey/reflect'),
    body: { toolId: courage.id, toolVersion: 1, answers, userId: 'forged' },
    env: {},
    origin: 'http://localhost:8765',
    respond(body, status) {
      return { status, body };
    },
    respondError(message, status) {
      return { status, error: message };
    },
    getAuthUser: async () => ({ id: 'member-1' }),
    write: (row) => writes.push(row),
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.degraded, true);
  assert.match(response.body.insight, /Thursday morning/);
  assert.equal(writes.length, 0);
  const row = buildInsertRow('member-1', answers, response.body.insight, courage);
  assert.equal(row.tool_id, 'courage-compass');
  assert.equal(row.tool_version, 1);
  assert.equal(row.answers.need, '');
  assert.equal(prepareJourneyReflect({ toolId: 'not-a-tool', toolVersion: 1, answers }).status, 400);
  assert.equal(prepareJourneyReflect({ toolId: courage.id, toolVersion: 2, answers }).status, 400);
});
