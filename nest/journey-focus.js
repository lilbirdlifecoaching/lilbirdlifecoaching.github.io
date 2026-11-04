/**
 * Pure helpers for returning a member to a saved Journey reflection.
 * Append-only reflections: Home focuses the latest row that still has a next_step.
 */

/** Stable ids only — rejects path fragments, query junk, and oversized values. */
const REFLECTION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** Newest-first rows → the reflection Home should treat as the active next step. */
export function pickLatestNextStep(rows) {
  if (!Array.isArray(rows)) return null;
  return rows.find((row) => hasNextStep(row)) || null;
}

/**
 * Resolve a return target by stable reflection id against the caller's own rows.
 * Foreign or inaccessible ids look the same as missing — never leak other members' data.
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

export const FOCUS_MISSING_STATUS =
  'That reflection is no longer in your Journey. Your other reflections are below.';

export const FOCUS_FOUND_STATUS = 'Here is the next step you saved.';
