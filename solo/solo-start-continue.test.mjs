/**
 * Mirrors Solo getSoloFocus decision rules used by the dashboard Continue panel.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const SESSIONS = [
  { number: 0, tag: 'Orientation', title: 'First Flight' },
  { number: 1, tag: 'Session 01', title: 'Story' },
  { number: 2, tag: 'Session 02', title: 'Vision & Goals' },
  { number: 3, tag: 'Session 03', title: 'Identity & Insight' },
  { number: 4, tag: 'Session 04', title: 'Working Through Transitions' },
  { number: 5, tag: 'Session 05', title: 'Life Rhythms & Routines' },
  { number: 6, tag: 'Session 06', title: 'Relationships & Community' },
  { number: 7, tag: 'Session 07', title: 'Full Flight' },
];

function getSoloFocus(sessionData) {
  const completed = sessionData.filter((s) => s.status === 'complete').length;
  const inProgress = sessionData.find((s) => s.status === 'in_progress');
  if (inProgress) {
    const session = SESSIONS.find((s) => s.number === inProgress.session_number);
    return { kind: 'continue', session, progress: inProgress, completed, resume: true };
  }
  const available = sessionData.find((s) => s.status === 'available');
  if (available) {
    const session = SESSIONS.find((s) => s.number === available.session_number);
    const isNew = completed === 0 && available.session_number === 0;
    return {
      kind: isNew ? 'start' : 'continue',
      session,
      progress: available,
      completed,
      resume: false,
    };
  }
  const waiting = sessionData.find(
    (s) => s.status === 'locked' && s.unlocks_at && new Date(s.unlocks_at) - Date.now() > 0
  );
  if (waiting) {
    const session = SESSIONS.find((s) => s.number === waiting.session_number);
    return { kind: 'waiting', session, progress: waiting, completed, resume: false };
  }
  return { kind: 'none', session: null, progress: null, completed, resume: false };
}

function row(n, status, unlocksAt) {
  return { session_number: n, status, unlocks_at: unlocksAt || null };
}

test('new owner: Start Session 0', () => {
  const focus = getSoloFocus([
    row(0, 'available'),
    row(1, 'locked'),
    row(2, 'locked'),
    row(3, 'locked'),
    row(4, 'locked'),
    row(5, 'locked'),
    row(6, 'locked'),
    row(7, 'locked'),
  ]);
  assert.equal(focus.kind, 'start');
  assert.equal(focus.session.number, 0);
  assert.equal(focus.resume, false);
});

test('session 0 in progress resumes that session', () => {
  const focus = getSoloFocus([
    row(0, 'in_progress'),
    row(1, 'locked'),
    row(2, 'locked'),
    row(3, 'locked'),
    row(4, 'locked'),
    row(5, 'locked'),
    row(6, 'locked'),
    row(7, 'locked'),
  ]);
  assert.equal(focus.kind, 'continue');
  assert.equal(focus.session.number, 0);
  assert.equal(focus.resume, true);
});

test('two complete → continue next available, not skip', () => {
  const focus = getSoloFocus([
    row(0, 'complete'),
    row(1, 'complete'),
    row(2, 'available'),
    row(3, 'locked'),
    row(4, 'locked'),
    row(5, 'locked'),
    row(6, 'locked'),
    row(7, 'locked'),
  ]);
  assert.equal(focus.kind, 'continue');
  assert.equal(focus.session.number, 2);
  assert.equal(focus.session.title, 'Vision & Goals');
});

test('in_progress wins over a later available session', () => {
  const focus = getSoloFocus([
    row(0, 'complete'),
    row(1, 'in_progress'),
    row(2, 'available'),
    row(3, 'locked'),
    row(4, 'locked'),
    row(5, 'locked'),
    row(6, 'locked'),
    row(7, 'locked'),
  ]);
  assert.equal(focus.session.number, 1);
  assert.equal(focus.resume, true);
});

test('time-locked next session shows waiting', () => {
  const unlocks = new Date(Date.now() + 20 * 3600000).toISOString();
  const focus = getSoloFocus([
    row(0, 'complete'),
    row(1, 'complete'),
    row(2, 'locked', unlocks),
    row(3, 'locked'),
    row(4, 'locked'),
    row(5, 'locked'),
    row(6, 'locked'),
    row(7, 'locked'),
  ]);
  assert.equal(focus.kind, 'waiting');
  assert.equal(focus.session.number, 2);
});

test('seven complete → continue session 7', () => {
  const focus = getSoloFocus([
    row(0, 'complete'),
    row(1, 'complete'),
    row(2, 'complete'),
    row(3, 'complete'),
    row(4, 'complete'),
    row(5, 'complete'),
    row(6, 'complete'),
    row(7, 'available'),
  ]);
  assert.equal(focus.kind, 'continue');
  assert.equal(focus.session.number, 7);
});

test('all complete yields none (dashboard uses complete hero instead)', () => {
  const focus = getSoloFocus([
    row(0, 'complete'),
    row(1, 'complete'),
    row(2, 'complete'),
    row(3, 'complete'),
    row(4, 'complete'),
    row(5, 'complete'),
    row(6, 'complete'),
    row(7, 'complete'),
  ]);
  assert.equal(focus.kind, 'none');
  assert.equal(focus.completed, 8);
});

/** Mirrors Nest progressSummary next-session choice. */
function nestProgressSummary(sessionProgress) {
  if (!sessionProgress.length) {
    return { state: 'start', nextNumber: 0 };
  }
  const complete = sessionProgress.filter((s) => s.status === 'complete').length;
  const inProgress = sessionProgress.find((s) => s.status === 'in_progress');
  if (inProgress) {
    return { state: 'continue', nextNumber: inProgress.session_number, resume: true };
  }
  const available = sessionProgress.find((s) => s.status === 'available');
  if (available) {
    const isStart = complete === 0 && available.session_number === 0;
    return {
      state: isStart ? 'start' : 'continue',
      nextNumber: available.session_number,
      resume: false,
    };
  }
  const waiting = sessionProgress.find(
    (s) => s.status === 'locked' && s.unlocks_at && new Date(s.unlocks_at) > Date.now()
  );
  if (waiting) return { state: 'waiting', nextNumber: waiting.session_number };
  if (complete >= 8) return { state: 'complete', nextNumber: null };
  return { state: 'continue', nextNumber: null };
}

test('Solo and Nest resolve the same next session across matrix', () => {
  const matrix = [
    [row(0, 'available'), row(1, 'locked'), row(2, 'locked'), row(3, 'locked'), row(4, 'locked'), row(5, 'locked'), row(6, 'locked'), row(7, 'locked')],
    [row(0, 'in_progress'), row(1, 'locked'), row(2, 'locked'), row(3, 'locked'), row(4, 'locked'), row(5, 'locked'), row(6, 'locked'), row(7, 'locked')],
    [row(0, 'complete'), row(1, 'complete'), row(2, 'available'), row(3, 'locked'), row(4, 'locked'), row(5, 'locked'), row(6, 'locked'), row(7, 'locked')],
    [row(0, 'complete'), row(1, 'in_progress'), row(2, 'available'), row(3, 'locked'), row(4, 'locked'), row(5, 'locked'), row(6, 'locked'), row(7, 'locked')],
    [
      row(0, 'complete'),
      row(1, 'complete'),
      row(2, 'locked', new Date(Date.now() + 3600000).toISOString()),
      row(3, 'locked'),
      row(4, 'locked'),
      row(5, 'locked'),
      row(6, 'locked'),
      row(7, 'locked'),
    ],
  ];
  for (const rows of matrix) {
    const solo = getSoloFocus(rows);
    const nest = nestProgressSummary(rows);
    assert.equal(solo.kind, nest.state, JSON.stringify(rows.map((r) => r.status)));
    assert.equal(solo.session?.number ?? null, nest.nextNumber);
  }
});

test('Nest unlock-on-hydrate filter matches Solo due-unlock rule', () => {
  const now = Date.now();
  const rows = [
    row(0, 'complete'),
    row(1, 'locked', new Date(now - 1000).toISOString()), // due
    row(2, 'locked'), // never unlocked by timer (no unlocks_at)
    row(3, 'locked', new Date(now + 86400000).toISOString()), // future
  ];
  const due = rows.filter((s) => s.status === 'locked' && s.unlocks_at && s.unlocks_at <= new Date(now).toISOString());
  assert.equal(due.length, 1);
  assert.equal(due[0].session_number, 1);
});

test('locked sessions are not openable via Continue navigation', () => {
  const rows = [
    row(0, 'complete'),
    row(1, 'locked', new Date(Date.now() + 3600000).toISOString()),
    row(2, 'locked'),
  ];
  function canOpen(sessionNumber) {
    const row = rows.find((s) => s.session_number === sessionNumber);
    if (!row) return false;
    return row.status === 'available' || row.status === 'in_progress' || row.status === 'complete';
  }
  assert.equal(canOpen(0), true);
  assert.equal(canOpen(1), false);
  assert.equal(canOpen(2), false);
});
