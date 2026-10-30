/**
 * Assessment authorization.
 *
 * A nest id never grants access. A course launch token never grants access
 * to an arbitrary assessment.
 *
 * The canvas value is an assessment capability token: a time-limited secret
 * for the browser that just created that one read. It can be presented more
 * than once before it expires. It is not a single-use token, and it is not
 * an ownership record. Saving the read does not move canvasTokenExpires.
 *
 * Ownership proof, strongest first:
 * - link: a deep_profile_links row whose ownership_proof is one of
 *   capability, read, or owner_email. A row with no proof is legacy.
 * - legacy: a deep_profile_links row created before proof was stored.
 *   It is not deleted. It does not authorize access, a retake, a new link,
 *   or an entitlement. The member recovers by signing in with the email
 *   already stored on the read.
 * - read: an existing nest_reads row for this account and this nest.
 * - email: the signed-in email matches the email already stored on the read.
 *   This keeps current members able to open a read. It was forgeable before
 *   this patch, so it is not strong enough to create a new link, copy paid
 *   status, or write nest_owner_emails.
 * - capability: unexpired token bound to this read, and only while the caller
 *   is signed out. A signed-in non-owner is refused even with a valid token.
 */

/** Proofs written only after an independent check. A missing value stays legacy. */
export const VERIFIED_LINK_PROOFS = ['capability', 'read', 'owner_email'];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Long enough to finish the read, the email step, and a canvas check-in. */
export const CANVAS_CAPABILITY_TTL_MS = 2 * 60 * 60 * 1000;

export function newCanvasToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function issueCanvasCapability(now = Date.now()) {
  return {
    canvasToken: newCanvasToken(),
    canvasTokenExpires: new Date(now + CANVAS_CAPABILITY_TTL_MS).toISOString(),
  };
}

export function capabilityStillValid(expires, now) {
  const stamp = Date.parse(expires || '');
  return Number.isFinite(stamp) && Number.isFinite(now) && stamp > now;
}

export function verifiedLinkProof(proof) {
  const value = String(proof || '');
  return VERIFIED_LINK_PROOFS.includes(value) ? value : null;
}

export function tokenMatches(presented, expected) {
  const a = String(presented || '');
  const b = String(expected || '');
  if (a.length < 32 || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export function canvasAccessDecision({ user, ownership, token, recordToken, tokenExpires, now, recordExists }) {
  const signedIn = !!user?.id;
  const fresh = tokenMatches(token, recordToken) && capabilityStillValid(tokenExpires, now);
  const knownOwner = ownership === 'link' || ownership === 'read' || ownership === 'email';
  if (signedIn && knownOwner && recordExists) {
    return { allow: true, via: 'owner', ownership };
  }
  if (!signedIn && fresh && recordExists) {
    return { allow: true, via: 'capability', ownership: null };
  }
  if (signedIn && ownership === 'legacy' && recordExists) {
    return {
      allow: false,
      status: 403,
      error: 'Not allowed',
      recovery: 'confirm-results-email',
      ownership: 'legacy',
    };
  }
  if (!signedIn) return { allow: false, status: 401, error: 'Please log in.', ownership: null };
  if (!recordExists) return { allow: false, status: 404, error: 'Not allowed', ownership: null };
  return { allow: false, status: 403, error: 'Not allowed', ownership: null };
}

export function canvasDenial(decision) {
  const body = { error: decision?.error || 'Not allowed' };
  if (decision?.recovery === 'confirm-results-email') body.recovery = 'confirm-results-email';
  return body;
}

/** Strong enough to write the claim table or create a new ownership row. */
export function mayRecordOwnerEmail(decision) {
  if (!decision?.allow) return false;
  if (decision.via === 'capability') return true;
  return decision.ownership === 'link' || decision.ownership === 'read';
}

/**
 * A course launch token identifies the course member. It does not identify
 * the assessment. Linking also needs the creating-browser capability, or an
 * existing link/read whose bound email is that course member's email.
 */
export function courseLinkDecision({ launchValid, access, boundEmail, courseUserEmail }) {
  if (!launchValid || !access?.allow) return { allow: false, status: 403, error: 'Not allowed' };
  const bound = String(boundEmail || '').trim().toLowerCase();
  const courseEmail = String(courseUserEmail || '').trim().toLowerCase();
  if (bound && (!courseEmail || bound !== courseEmail)) {
    return { allow: false, status: 403, error: 'Not allowed' };
  }
  if (access.via === 'capability') return { allow: true, via: 'capability' };
  if ((access.ownership === 'link' || access.ownership === 'read') && bound && bound === courseEmail) {
    return { allow: true, via: 'owner' };
  }
  return { allow: false, status: 403, error: 'Not allowed' };
}

/** Paid status and the original retake counter move only for a strong owner. */
export function retakeDecision(access) {
  if (!access?.allow) {
    return { allow: false, status: access?.status || 403, error: access?.error || 'Not allowed' };
  }
  if (access.via === 'capability' || access.ownership === 'link' || access.ownership === 'read') {
    return { allow: true, via: access.via, ownership: access.ownership || null };
  }
  return { allow: false, status: 403, error: 'Not allowed' };
}

/**
 * Nest Plus is a product gate for the caller's own read. It is not permission
 * to load a stored profile. The partner's details in this feature are text
 * the caller types, not another member's saved assessment.
 */
export function partnerProfileDecision({ access, callerHasNestPlus, recordHasNestPlus }) {
  if (!access?.allow) {
    return { allow: false, status: access?.status || 403, error: access?.error || 'Not allowed' };
  }
  if (!recordHasNestPlus && !callerHasNestPlus) {
    return { allow: false, status: 403, error: 'nest_plus_required' };
  }
  return { allow: true, via: access.via };
}

/**
 * A profile object the participant submits is their own disclosure.
 * Loading a stored profile still requires access to that assessment.
 */
export function bridgeProfileDecision({ access, suppliedProfile }) {
  if (suppliedProfile && typeof suppliedProfile === 'object' && !Array.isArray(suppliedProfile)) {
    return { allow: true, via: 'submitted' };
  }
  if (!access?.allow) {
    return { allow: false, status: access?.status || 403, error: access?.error || 'Not allowed' };
  }
  return { allow: true, via: access.via };
}

/**
 * A couple id and a member id are not participation.
 * A participant secret issued at create or join is. An older session with no
 * secret stays usable only when this caller can already open the nest stored
 * on that same member row.
 * A refusal is the same shape as a missing session and carries no names,
 * profiles, nest ids, or check-in text.
 */
export function bridgeParticipantDecision({ couple, memberId, secret, nestAccess }) {
  const missing = { allow: false, status: 404, error: 'Not found' };
  if (!couple || typeof couple !== 'object' || Array.isArray(couple)) return missing;
  const id = String(memberId || '');
  if (!id) return missing;
  const members = Array.isArray(couple.members) ? couple.members : [];
  const member = members.find((item) => item && String(item.memberId) === id);
  if (!member) return missing;
  if (tokenMatches(secret, member.secret)) return { allow: true, via: 'secret', memberId: id };
  const nestId = String(member.nestId || '');
  const sameNest = !!(
    nestAccess
    && nestAccess.allow
    && nestId
    && String(nestAccess.nestId || '') === nestId
    && (nestAccess.via === 'owner' || nestAccess.via === 'capability')
  );
  if (sameNest) return { allow: true, via: 'nest', memberId: id };
  return missing;
}

export function bridgeDenial() {
  return { error: 'Not found' };
}

export function bridgeMemberSecret() {
  return newCanvasToken();
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
 * only after this same email match on nest_owner_emails. An empty or
 * different email is a refusal. This does not revoke an existing entitlement.
 */
export function claimDecision({ user, boundEmail }) {
  if (!user?.id) return { allow: false, status: 401, error: 'Please log in.' };
  const bound = String(boundEmail || '').trim().toLowerCase();
  const caller = String(user.email || '').trim().toLowerCase();
  if (!bound || !caller || bound !== caller) return { allow: false, status: 403, error: 'Not allowed' };
  return { allow: true };
}
