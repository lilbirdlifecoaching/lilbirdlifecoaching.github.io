/**
 * Life Canvas and Inner Compass claim decisions.
 * A nest id is never access. The assessment worker calls these helpers
 * before it reads or writes a canvas, an email, or a paid read.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function newCanvasToken() {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

export function tokenMatches(presented, expected) {
  const a = String(presented || '');
  const b = String(expected || '');
  if (a.length < 32 || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/**
 * Owner: the signed-in account is linked to this nest, or the account email
 * matches the email already bound to the read.
 * Session: the browser that just created the read, and only while that browser
 * is not signed in as someone else. A signed-in account that does not own the
 * read is refused even if it also presents the session token.
 */
export function canvasAccessDecision({ user, owned, token, recordToken, recordExists }) {
  const signedIn = !!user?.id;
  const sessionOk = tokenMatches(token, recordToken);
  if (signedIn && owned && recordExists) return { allow: true, via: 'owner' };
  if (!signedIn && sessionOk && recordExists) return { allow: true, via: 'session' };
  if (!signedIn) return { allow: false, status: 401, error: 'Please log in.' };
  if (!recordExists) return { allow: false, status: 404, error: 'Not allowed' };
  return { allow: false, status: 403, error: 'Not allowed' };
}

export function canvasDenial(decision) {
  return { error: decision?.error || 'Not allowed' };
}

/** First email bind only. A different address never replaces one already stored. */
export function emailToBind(record, incoming) {
  const next = String(incoming || '').trim().toLowerCase();
  if (!EMAIL.test(next)) return null;
  const current = String(record?.email || '').trim().toLowerCase();
  if (!current || current === next) return next;
  return null;
}

export function applyCanvasWrite(record, body) {
  const next = { ...record };
  const bind = emailToBind(record, body?.email);
  if (bind) next.email = bind;
  if (Array.isArray(body?.canvasHistory) && body.canvasHistory.length) {
    const existing = Array.isArray(next.canvasHistory) ? next.canvasHistory : [];
    const existingDates = new Set(existing.map((entry) => entry && entry.date));
    const fresh = body.canvasHistory.filter((entry) => entry && !existingDates.has(entry.date));
    next.canvasHistory = [...fresh, ...existing].slice(0, 24);
  }
  if (body?.canvasScores && typeof body.canvasScores === 'object') next.canvasScores = body.canvasScores;
  if (body?.assessmentMode) next.assessmentMode = body.assessmentMode;
  if (body?.peakPlunge && typeof body.peakPlunge === 'object') next.peakPlunge = body.peakPlunge;
  if (body?.pairTheseLog && typeof body.pairTheseLog === 'object') next.pairTheseLog = body.pairTheseLog;
  return { record: next, emailToBind: bind };
}

/**
 * Grants nothing by itself. The database function may grant inner_compass
 * only after this same email match. An empty or different email is a refusal.
 * This does not revoke an entitlement that already exists.
 */
export function claimDecision({ user, boundEmail }) {
  if (!user?.id) return { allow: false, status: 401, error: 'Please log in.' };
  const bound = String(boundEmail || '').trim().toLowerCase();
  const caller = String(user.email || '').trim().toLowerCase();
  if (!bound || !caller || bound !== caller) return { allow: false, status: 403, error: 'Not allowed' };
  return { allow: true };
}
