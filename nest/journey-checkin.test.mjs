import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CHECKIN_RESPONSES,
  clipCheckinNote,
  isMemberCheckinResponse,
  resolveActiveFocus,
} from './journey-focus.js';

const OWNER = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa0';
const OTHER = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const R1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
const R2 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2';

function memoryJourneyDb() {
  const reflections = [];
  const checkins = [];
  function from(table) {
    return {
      insert(row) {
        if (table === 'journey_reflections') {
          if (row.user_id !== OWNER) {
            return { select: async () => ({ data: null, error: { message: 'rls' } }) };
          }
          const stored = Object.assign({ id: row.id || R2, created_at: new Date().toISOString() }, row);
          reflections.push(stored);
          if (stored.next_step && String(stored.next_step).trim()) {
            checkins.unshift({
              id: 'c' + checkins.length,
              user_id: stored.user_id,
              reflection_id: stored.id,
              response: CHECKIN_RESPONSES.ACTIVATED,
              note: null,
              created_at: new Date(Date.now() + 1).toISOString(),
            });
          }
          return { select: async () => ({ data: [{ id: stored.id }], error: null }) };
        }
        if (table === 'journey_checkins') {
          if (row.user_id !== OWNER) {
            return { select: async () => ({ data: null, error: { message: 'rls' } }) };
          }
          const owned = reflections.some((item) => item.id === row.reflection_id && item.user_id === OWNER);
          if (!owned) {
            return { select: async () => ({ data: null, error: { message: 'rls reflection' } }) };
          }
          const stored = Object.assign(
            { id: 'c' + (checkins.length + 1), created_at: new Date().toISOString() },
            row
          );
          checkins.unshift(stored);
          return { select: async () => ({ data: [stored], error: null }) };
        }
        return { select: async () => ({ data: null, error: { message: 'unknown' } }) };
      },
      delete() {
        let reflectionId = '';
        return {
          eq(field, value) {
            if (field === 'id') reflectionId = value;
            return {
              eq(ownerField, ownerId) {
                if (table !== 'journey_reflections' || ownerField !== 'user_id') {
                  return { error: { message: 'denied' } };
                }
                // Simulate ON DELETE SET NULL + note clear for the named reflection.
                for (let i = reflections.length - 1; i >= 0; i -= 1) {
                  if (reflections[i].id === reflectionId && reflections[i].user_id === ownerId) {
                    reflections.splice(i, 1);
                    checkins.forEach((c) => {
                      if (c.reflection_id === reflectionId) {
                        c.note = null;
                        c.reflection_id = null;
                      }
                    });
                  }
                }
                return { error: null };
              },
            };
          },
        };
      },
    };
  }
  return { reflections, checkins, from };
}

test('member check-in responses are the four UI choices only', () => {
  assert.equal(isMemberCheckinResponse(CHECKIN_RESPONSES.TOOK_STEP), true);
  assert.equal(isMemberCheckinResponse(CHECKIN_RESPONSES.ACTIVATED), false);
  assert.equal(clipCheckinNote('<script>'), '<script>');
});

test('new next-step save activates focus even after a clear (trigger semantics)', async () => {
  const db = memoryJourneyDb();
  db.reflections.push({
    id: R1,
    user_id: OWNER,
    next_step: 'Old step',
    created_at: '2026-01-01T00:00:00Z',
  });
  await db.from('journey_checkins').insert({
    user_id: OWNER,
    reflection_id: R1,
    response: CHECKIN_RESPONSES.DONE_FOR_NOW,
    note: 'resting',
  }).select();
  assert.equal(resolveActiveFocus(db.reflections, db.checkins).status, 'resting');

  await db.from('journey_reflections').insert({
    id: R2,
    user_id: OWNER,
    next_step: 'Walk after dinner',
  }).select();
  const focus = resolveActiveFocus(db.reflections, db.checkins);
  assert.equal(focus.status, 'active');
  assert.equal(focus.reflection.id, R2);
});

test('foreign user cannot insert a check-in on another member reflection', async () => {
  const db = memoryJourneyDb();
  db.reflections.push({ id: R1, user_id: OWNER, next_step: 'Mine', created_at: '2026-01-01T00:00:00Z' });
  const forged = await db.from('journey_checkins').insert({
    user_id: OTHER,
    reflection_id: R1,
    response: CHECKIN_RESPONSES.TOOK_STEP,
    note: null,
  }).select();
  assert.equal(forged.error.message, 'rls');
  assert.equal(db.checkins.length, 0);
});

test('deleting a reflection orphans newest keep-event into resting', async () => {
  const db = memoryJourneyDb();
  db.reflections.push(
    { id: R1, user_id: OWNER, next_step: 'Older', created_at: '2026-01-01T00:00:00Z' },
    { id: R2, user_id: OWNER, next_step: 'Newer', created_at: '2026-02-01T00:00:00Z' }
  );
  db.checkins.unshift({
    id: 'c-keep',
    user_id: OWNER,
    reflection_id: R2,
    response: CHECKIN_RESPONSES.TOOK_STEP,
    note: 'private note',
    created_at: '2026-02-02T00:00:00Z',
  });
  db.checkins.push({
    id: 'c-old',
    user_id: OWNER,
    reflection_id: R1,
    response: CHECKIN_RESPONSES.STILL_WORKING,
    note: null,
    created_at: '2026-01-02T00:00:00Z',
  });
  await db.from('journey_reflections').delete().eq('id', R2).eq('user_id', OWNER);
  assert.equal(db.checkins[0].reflection_id, null);
  assert.equal(db.checkins[0].note, null);
  const focus = resolveActiveFocus(db.reflections, db.checkins);
  assert.equal(focus.status, 'resting');
});

test('page wires check-in UI and shared focus helper', () => {
  const page = readFileSync(new URL('./journey.js', import.meta.url), 'utf8');
  const client = readFileSync(new URL('./nest-client.js', import.meta.url), 'utf8');
  const focus = readFileSync(new URL('./journey-focus.js', import.meta.url), 'utf8');
  const sql = readFileSync(new URL('../docs/migrations/journey-checkins.sql', import.meta.url), 'utf8');
  assert.match(page, /resolveActiveFocus/);
  assert.match(page, /How has this next step been going\?/);
  assert.match(page, /data-toggle-checkin/);
  assert.match(page, /data-toggle-history/);
  assert.match(page, /data-toggle-details/);
  assert.match(page, /aria-controls="details-/);
  assert.match(page, /aria-controls="checkin-/);
  assert.match(page, /aria-controls="history-/);
  assert.match(page, /toggleJourneyPanel/);
  assert.match(page, /resolveJourneyPanel/);
  assert.match(page, /data-choose-again/);
  assert.match(page, /data-jump-tools/);
  assert.match(page, /id="journey-tools"/);
  assert.match(page, /journey_checkins/);
  assert.match(page, /checkinsError/);
  assert.match(page, /focusAction/);
  assert.equal(page.includes('gentle check-in'), false);
  assert.equal(page.includes('Steps you saved'), false);
  assert.match(client, /What\'s next\?/);
  assert.match(client, /LilbirdJourneyFocus/);
  assert.match(client, /refreshJourneySignals/);
  assert.match(client, /checkinsError/);
  // Home must call the shared module API — not a second full algorithm copy.
  assert.match(client, /api\.resolveActiveFocus\(reflections, checkins, options\)/);
  assert.equal(client.includes("response === 'choose_again'"), false);
  assert.match(focus, /LilbirdJourneyFocus/);
  assert.match(focus, /What\'s next\?/);
  assert.match(sql, /journey_activate_on_next_step/);
  assert.match(sql, /journey_purge_checkins_when_no_reflections/);
  assert.match(sql, /on delete set null/);
  assert.match(sql, /char_length\(note\) <= 1000/);
  assert.match(sql, /set search_path = public/);
  assert.equal(/for update/i.test(sql), false);
});

test('Home and Journey share one resolveActiveFocus implementation', async () => {
  const mod = await import('./journey-focus.js');
  assert.equal(typeof mod.resolveActiveFocus, 'function');
  assert.equal(mod.FOCUS_API_VERSION, 3);
  // Simulate what nest-client does after the module assigns window.LilbirdJourneyFocus.
  const viaWindow = globalThis.LilbirdJourneyFocus.resolveActiveFocus;
  assert.equal(viaWindow, mod.resolveActiveFocus);
  const rows = [{ id: R2, next_step: 'Write the letter', created_at: '2026-02-20T00:00:00Z' }];
  const a = mod.resolveActiveFocus(rows, []);
  const b = viaWindow(rows, []);
  assert.deepEqual(a, b);
});
