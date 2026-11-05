/**
 * Journey focus helpers (P2a deep-link + P2b check-in focus).
 * Current focus is derived from journey_checkins — no pointer table.
 */

/** Stable ids only — rejects path fragments, query junk, and oversized values. */
const REFLECTION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const CHECKIN_RESPONSES = Object.freeze({
  TOOK_STEP: 'took_step',
  STILL_WORKING: 'still_working',
  CHANGED: 'changed',
  DONE_FOR_NOW: 'done_for_now',
  CHOOSE_AGAIN: 'choose_again',
  ACTIVATED: 'activated',
});

const KEEP = new Set([
  CHECKIN_RESPONSES.TOOK_STEP,
  CHECKIN_RESPONSES.STILL_WORKING,
  CHECKIN_RESPONSES.CHOOSE_AGAIN,
  CHECKIN_RESPONSES.ACTIVATED,
]);

const CLEAR = new Set([
  CHECKIN_RESPONSES.CHANGED,
  CHECKIN_RESPONSES.DONE_FOR_NOW,
]);

export const MEMBER_CHECKIN_CHOICES = Object.freeze([
  {
    response: CHECKIN_RESPONSES.TOOK_STEP,
    label: 'I took a step',
    notePrompt: 'Anything you want to remember about what you tried?',
    confirm: 'Thank you for noticing that. This stays as your next step when you return.',
  },
  {
    response: CHECKIN_RESPONSES.STILL_WORKING,
    label: 'Still working on it',
    notePrompt: 'Anything on your mind about this?',
    confirm: 'That’s okay. It will be here when you come back.',
  },
  {
    response: CHECKIN_RESPONSES.CHANGED,
    label: 'Something has changed',
    notePrompt: 'What shifted, if you want to say?',
    confirm: 'Something shifted. You’ve set this intention aside for now.',
  },
  {
    response: CHECKIN_RESPONSES.DONE_FOR_NOW,
    label: 'Done for now',
    notePrompt: 'Anything you want to leave with this?',
    confirm: 'Rest is part of the path. This is kept in your history.',
  },
]);

export const NOTE_MAX = 1000;

export function normalizeReflectionId(raw) {
  const id = String(raw || '').trim();
  if (!id || id.length > 64) return '';
  if (!REFLECTION_ID_RE.test(id)) return '';
  return id.toLowerCase();
}

export function hasNextStep(row) {
  if (!row || typeof row !== 'object') return false;
  const column = String(row.next_step || '').trim();
  if (column) return true;
  const answers = row.answers && typeof row.answers === 'object' ? row.answers : null;
  return !!(answers && String(answers.nextStep || '').trim());
}

/** Newest-first rows → legacy active next step when there are no check-ins. */
export function pickLatestNextStep(rows) {
  if (!Array.isArray(rows)) return null;
  return rows.find((row) => hasNextStep(row)) || null;
}

/**
 * Resolve a return target by stable reflection id against the caller's own rows.
 * @returns {{ status: 'found'|'missing'|'none'|'invalid', reflection: object|null }}
 */
export function resolveFocusReflection(rows, preferredId) {
  const raw = String(preferredId || '').trim();
  if (!raw) return { status: 'none', reflection: null };
  const id = normalizeReflectionId(raw);
  if (!id) return { status: 'invalid', reflection: null };
  const list = Array.isArray(rows) ? rows : [];
  const match = list.find((row) => row && normalizeReflectionId(row.id) === id);
  if (match) return { status: 'found', reflection: match };
  return { status: 'missing', reflection: null };
}

export function clipCheckinNote(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  return text.slice(0, NOTE_MAX);
}

export function isMemberCheckinResponse(response) {
  return MEMBER_CHECKIN_CHOICES.some((item) => item.response === response);
}

export function checkinChoice(response) {
  return MEMBER_CHECKIN_CHOICES.find((item) => item.response === response) || null;
}

export function historyLabel(response) {
  if (response === CHECKIN_RESPONSES.TOOK_STEP) return 'Took a step';
  if (response === CHECKIN_RESPONSES.STILL_WORKING) return 'Still working on it';
  if (response === CHECKIN_RESPONSES.CHANGED) return 'Something changed';
  if (response === CHECKIN_RESPONSES.DONE_FOR_NOW) return 'Done for now';
  if (response === CHECKIN_RESPONSES.CHOOSE_AGAIN) return 'Chose this again';
  if (response === CHECKIN_RESPONSES.ACTIVATED) return 'Became your focus';
  return 'Check-in';
}

/** Deterministic newest-first: created_at desc, id desc. */
export function sortCheckinsNewestFirst(checkins) {
  const list = Array.isArray(checkins) ? checkins.slice() : [];
  list.sort((a, b) => {
    const ta = Date.parse(a && a.created_at) || 0;
    const tb = Date.parse(b && b.created_at) || 0;
    if (tb !== ta) return tb - ta;
    const ida = String((a && a.id) || '');
    const idb = String((b && b.id) || '');
    if (idb > ida) return 1;
    if (idb < ida) return -1;
    return 0;
  });
  return list;
}

function reflectionById(rows, id) {
  const normalized = normalizeReflectionId(id);
  if (!normalized) return null;
  const list = Array.isArray(rows) ? rows : [];
  return list.find((row) => row && normalizeReflectionId(row.id) === normalized) || null;
}

/**
 * Shared Home + Journey focus resolver.
 * Newest check-in decides; never walk older events after a clear/orphan.
 * Zero check-ins → legacy newest next_step (P2a).
 *
 * @returns {{
 *   status: 'active'|'resting'|'none',
 *   reflection: object|null,
 *   source: object|null,
 *   legacy: boolean
 * }}
 */
/**
 * @param {object} [options]
 * @param {boolean} [options.checkinsUnavailable] table missing → legacy P2a
 * @param {boolean} [options.checkinsError] load failed → do not invent legacy focus
 */
export function resolveActiveFocus(reflections, checkins, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const rows = Array.isArray(reflections) ? reflections : [];

  if (opts.checkinsError) {
    return { status: 'none', reflection: null, source: null, legacy: false, error: true };
  }

  const events = sortCheckinsNewestFirst(checkins);

  if (events.length) {
    const newest = events[0];
    const response = String((newest && newest.response) || '');
    if (CLEAR.has(response)) {
      return { status: 'resting', reflection: null, source: newest, legacy: false };
    }
    const reflection = reflectionById(rows, newest && newest.reflection_id);
    if (!reflection || !hasNextStep(reflection)) {
      // Missing / orphaned / empty next_step — resting; do not scan older events.
      return { status: 'resting', reflection: null, source: newest, legacy: false };
    }
    if (KEEP.has(response)) {
      return { status: 'active', reflection, source: newest, legacy: false };
    }
    // Unknown response on newest event: fail closed to resting.
    return { status: 'resting', reflection: null, source: newest, legacy: false };
  }

  const legacy = pickLatestNextStep(rows);
  if (legacy) {
    return { status: 'active', reflection: legacy, source: null, legacy: true };
  }
  return { status: 'none', reflection: null, source: null, legacy: false };
}

export const FOCUS_MISSING_STATUS =
  'That reflection is no longer in your Journey. Your other reflections are below.';

export const FOCUS_FOUND_STATUS = 'Here is the next step you saved.';

export const RESTING_CHAPTER = Object.freeze({
  kicker: 'Your next chapter',
  title: "What's next?",
  body: "You've put your last step aside. When you're ready, you can choose what you'd like to work on next.",
  primaryLabel: 'Explore My Journey',
});

/** Shared by Nest Home (classic script) and My Journey (ES module). */
export const FOCUS_API_VERSION = 2;

const focusRoot = typeof globalThis !== 'undefined' ? globalThis : null;
if (focusRoot) {
  focusRoot.LilbirdJourneyFocus = {
    version: FOCUS_API_VERSION,
    resolveActiveFocus,
    resolveFocusReflection,
    pickLatestNextStep,
    hasNextStep,
    sortCheckinsNewestFirst,
    normalizeReflectionId,
    CHECKIN_RESPONSES,
    MEMBER_CHECKIN_CHOICES,
    RESTING_CHAPTER,
    NOTE_MAX,
    clipCheckinNote,
    checkinChoice,
    historyLabel,
    isMemberCheckinResponse,
  };
}
