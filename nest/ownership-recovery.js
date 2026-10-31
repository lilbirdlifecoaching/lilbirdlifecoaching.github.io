/**
 * Inner Compass ownership recovery.
 *
 * A nest id, a legacy link, and a matching email string are different facts.
 * None of them writes an ownership row. The only automated grant is a
 * short-lived confirmation sent to the email already stored on that
 * assessment, opened by the same signed-in member. Cloudflare KV cannot
 * delete a key atomically, so two overlapping confirmations can both pass
 * the token check. Both are limited to that same user, assessment, and
 * confirmed email. The nest_owner_emails primary key is what keeps a
 * second owner out.
 */

export const RECOVERY_TTL_MS = 30 * 60 * 1000;
export const RECOVERY_LIMIT = 3;
export const RECOVERY_WINDOW_MS = 60 * 60 * 1000;

export const RECOVERY_MESSAGE = 'If this read was saved with the confirmed email on this Nest, a one-time confirmation is on its way. It expires in 30 minutes. If nothing arrives, write hello@lilbird.life from the address that received the read.';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return EMAIL.test(email) ? email : '';
}

export function confirmedRecoveryEmail(user) {
  if (!user?.id) return '';
  if (!user.email_confirmed_at && !user.confirmed_at) return '';
  return normalizeEmail(user.email);
}

/**
 * Independent association only. A legacy link is not passed in.
 * A matching assessment email is not an input.
 */
export function recoveryAssociation({ verifiedLink = false, hasRead = false, boundEmail = '', confirmedEmail = '' } = {}) {
  if (verifiedLink) return 'link';
  if (hasRead) return 'read';
  const bound = normalizeEmail(boundEmail);
  const confirmed = normalizeEmail(confirmedEmail);
  if (!bound) return null;
  if (confirmed && bound === confirmed) return 'bound';
  return 'conflict';
}

/** Whether a confirmation may be mailed. This does not grant ownership. */
export function maySendRecovery({ confirmedEmail, storedEmail }) {
  const confirmed = normalizeEmail(confirmedEmail);
  const stored = normalizeEmail(storedEmail);
  if (!confirmed || !stored) return false;
  return confirmed === stored;
}

export function recentRecoveryAttempts(stamps, now, windowMs = RECOVERY_WINDOW_MS) {
  return (Array.isArray(stamps) ? stamps : []).filter((stamp) => Number.isFinite(stamp) && now - stamp < windowMs);
}

export function recoveryLimited(stamps, now, limit = RECOVERY_LIMIT, windowMs = RECOVERY_WINDOW_MS) {
  return recentRecoveryAttempts(stamps, now, windowMs).length >= limit;
}

export function recoveryRequestDecision({
  user,
  storedEmail = '',
  association = null,
  userAttempts = [],
  nestAttempts = [],
  now,
}) {
  if (!user?.id) return { status: 401, body: { error: 'Please log in.' }, send: false };
  if (recoveryLimited(userAttempts, now) || recoveryLimited(nestAttempts, now)) {
    return { status: 429, body: { error: 'Too many requests. Try again later.' }, send: false };
  }
  if (association === 'link' || association === 'read' || association === 'bound') {
    return { status: 200, body: { ok: true, owned: true }, send: false };
  }
  if (association === 'conflict') {
    return { status: 200, body: { ok: true, message: RECOVERY_MESSAGE }, send: false };
  }
  const confirmed = confirmedRecoveryEmail(user);
  return {
    status: 200,
    body: { ok: true, message: RECOVERY_MESSAGE },
    send: maySendRecovery({ confirmedEmail: confirmed, storedEmail }),
    to: maySendRecovery({ confirmedEmail: confirmed, storedEmail }) ? normalizeEmail(storedEmail) : '',
  };
}

export function newRecoveryToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function recoveryRecord({ userId, nestId, now }) {
  return {
    userId,
    nestId,
    expiresAt: new Date(now + RECOVERY_TTL_MS).toISOString(),
  };
}

export function recoveryConsumeDecision({ record, user, storedEmail, now }) {
  const denied = { ok: false, status: 403, body: { error: 'Not allowed' }, consume: false };
  if (!record || !user?.id) return denied;
  if (record.userId !== user.id || !record.nestId) return denied;
  const expires = Date.parse(record.expiresAt || '');
  if (!Number.isFinite(expires) || expires <= now) return { ...denied, consume: true };
  const confirmed = confirmedRecoveryEmail(user);
  if (!maySendRecovery({ confirmedEmail: confirmed, storedEmail })) return denied;
  return { ok: true, status: 200, body: { ok: true, nestId: record.nestId }, consume: true, email: confirmed };
}
