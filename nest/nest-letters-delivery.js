/**
 * Enrollment and delivery for Track A, the Nest coaching journey.
 *
 * State lives per Nest account, not on a shared calendar.
 * A purchase does not read or write this state.
 * Progress moves only after a send is recorded as sent.
 * A provider acceptance that is never recorded does not move the sequence.
 * The same delivery id is the Resend Idempotency-Key on POST /emails, so a retry
 * inside 24 hours with the same body does not create a second email. A changed
 * body returns 409 and is recorded as the original send, still without a second
 * email. This is not an exactly-once guarantee:
 * if that record is still missing after the idempotency window, the letter is held
 * and is not sent again on its own.
 *
 * Cloudflare KV is not the store. Two cron runs can read the same key
 * before either write lands, so a letter could go out twice or a step
 * could advance early. The production store is Postgres, with a
 * conditional lock and a unique delivery id. See nest-letters.sql.
 * Sends stay off until NEST_LETTERS_ENABLED is exactly "true".
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;
export const CLAIM_TTL_MS = 15 * 60 * 1000;
export const LOCK_TTL_MS = 2 * 60 * 1000;
/** Resend keeps an Idempotency-Key for 24 hours. After that the same key can send again. */
export const IDEMPOTENCY_WINDOW_MS = 24 * HOUR_MS;

export const DEFAULT_SCHEDULE = {
  introDelayDays: 2,
  afterWelcomeDays: 14,
  welcomeSequenceDays: 24,
  intervalDays: 14,
  checkinIntervalDays: 90,
  retryHours: [1, 6, 24],
};

export const PRODUCT_FLOWS = ['ff', 'coaching', 'solo', 'abandoned', 'quiz', 'glow', 'checkin'];
export const NEST_LETTERS_SENDER = 'lilbird-assessment';

export function emailVerified(user) {
  if (!user?.id || !user?.email) return false;
  return !!(user.email_confirmed_at || user.confirmed_at);
}

export function letterStartAt(now, seq, schedule = DEFAULT_SCHEDULE) {
  const intro = now + schedule.introDelayDays * DAY_MS;
  if (seq && seq.done !== true && seq.enrolledAt) {
    const enrolled = Date.parse(seq.enrolledAt);
    if (Number.isFinite(enrolled)) {
      const after = enrolled + (schedule.welcomeSequenceDays + schedule.afterWelcomeDays) * DAY_MS;
      return Math.max(intro, after);
    }
  }
  return intro;
}

export function deliveryKey(userId, letterKey) {
  return `${userId}:${letterKey}`;
}

export function nextLetterKey(state) {
  if (!state?.welcomeSent) return 'welcome';
  if (state.phase === 'checkin') return `q${state.checkinCycle || 0}-${state.step || 0}`;
  const n = (state.step || 0) + 1;
  return `n${String(n).padStart(2, '0')}`;
}

function blankState(user, now, extra) {
  return {
    userId: user.id,
    email: String(user.email).toLowerCase(),
    nestCoaching: false,
    productCoaching: true,
    status: 'none',
    phase: 'welcome',
    step: 0,
    checkinCycle: 0,
    nextAt: null,
    letterStartAt: null,
    welcomeSent: false,
    attempt: 0,
    updatedAt: now,
    ...extra,
  };
}

/**
 * choice: 'yes' | 'no'
 * reaffirm: required when a global unsubscribe or a Nest unsubscribe already exists
 * seq: the existing 10-email welcome record, if any. Done sequences use the short delay.
 */
export function enroll({ user, choice, reaffirm = false, now, seq = null, suppressed = false, existing = null, schedule = DEFAULT_SCHEDULE }) {
  if (!user?.id || !user?.email) return { ok: false, reason: 'unauthenticated' };
  if (!emailVerified(user)) return { ok: false, reason: 'unverified' };
  if (choice !== 'yes' && choice !== 'no') return { ok: false, reason: 'choice' };

  const blocked = suppressed || existing?.status === 'unsubscribed';
  if (blocked && !reaffirm) return { ok: false, reason: 'unsubscribed' };

  if (choice === 'no') {
    return {
      ok: true,
      clearGlobalSuppression: false,
      state: blankState(user, now, {
        nestCoaching: false,
        productCoaching: existing?.productCoaching !== false,
        status: 'declined',
        phase: existing?.phase || 'welcome',
        step: existing?.step || 0,
        checkinCycle: existing?.checkinCycle || 0,
        welcomeSent: existing?.welcomeSent === true,
        letterStartAt: existing?.letterStartAt || null,
        nextAt: null,
      }),
    };
  }

  if (existing && (existing.status === 'active' || existing.status === 'checkin') && existing.nestCoaching) {
    return { ok: true, clearGlobalSuppression: !!suppressed && reaffirm, state: { ...existing, email: String(user.email).toLowerCase(), updatedAt: now } };
  }

  const start = letterStartAt(now, seq, schedule);
  const resume = existing && (existing.welcomeSent || existing.step > 0 || existing.phase === 'checkin');
  return {
    ok: true,
    clearGlobalSuppression: !!suppressed && reaffirm,
    state: blankState(user, now, {
      nestCoaching: true,
      productCoaching: existing?.productCoaching !== false,
      status: resume && existing.phase === 'checkin' ? 'checkin' : 'active',
      phase: resume ? existing.phase : 'welcome',
      step: resume ? existing.step : 0,
      checkinCycle: resume ? existing.checkinCycle || 0 : 0,
      welcomeSent: resume ? existing.welcomeSent === true : false,
      letterStartAt: resume ? existing.letterStartAt || start : start,
      nextAt: resume ? now : now,
      attempt: 0,
    }),
  };
}

export function setPreferences({ user, existing, now, nestCoaching, productCoaching, reaffirm = false, suppressed = false, seq = null, schedule = DEFAULT_SCHEDULE }) {
  if (nestCoaching === true) {
    return enroll({ user, choice: 'yes', reaffirm: reaffirm || !suppressed, now, seq, suppressed, existing, schedule });
  }
  if (nestCoaching === false) {
    return unsubscribe(existing, now, { productCoaching });
  }
  if (!existing) return { ok: false, reason: 'none' };
  return {
    ok: true,
    clearGlobalSuppression: false,
    state: {
      ...existing,
      productCoaching: productCoaching == null ? existing.productCoaching : !!productCoaching,
      updatedAt: now,
    },
  };
}

export function unsubscribe(state, now, extra = {}) {
  if (!state) return { ok: false, reason: 'none' };
  return {
    ok: true,
    clearGlobalSuppression: false,
    state: {
      ...state,
      nestCoaching: false,
      productCoaching: extra.productCoaching == null ? state.productCoaching : !!extra.productCoaching,
      status: 'unsubscribed',
      nextAt: null,
      updatedAt: now,
    },
  };
}

/** Purchases, logins, and profile updates must not move Track A. */
export function applyAccountEvent(state) {
  return state ? { ...state } : null;
}

export function productSendAllowed(state) {
  if (!state) return true;
  return state.productCoaching !== false;
}

export function sameUtcDay(a, b) {
  const left = new Date(a);
  const right = new Date(b);
  return left.getUTCFullYear() === right.getUTCFullYear()
    && left.getUTCMonth() === right.getUTCMonth()
    && left.getUTCDate() === right.getUTCDate();
}

export function planSend({ state, now, otherMailDue = false }) {
  if (!state || !state.nestCoaching || state.status === 'unsubscribed' || state.status === 'declined') {
    return { action: 'skip' };
  }
  if (state.nextAt == null || state.nextAt > now) return { action: 'wait' };
  if (otherMailDue && sameUtcDay(state.nextAt, now)) {
    return { action: 'defer', nextAt: now + DAY_MS };
  }
  return { action: 'send', letterKey: nextLetterKey(state) };
}

export function advanceAfterSend(state, now, schedule = DEFAULT_SCHEDULE) {
  const next = { ...state, attempt: 0, updatedAt: now };
  if (!state.welcomeSent) {
    next.welcomeSent = true;
    next.phase = 'letters';
    next.step = 0;
    next.status = 'active';
    next.nextAt = state.letterStartAt && state.letterStartAt > now
      ? state.letterStartAt
      : now + schedule.introDelayDays * DAY_MS;
    return next;
  }
  if (state.phase === 'checkin') {
    const step = (state.step || 0) + 1;
    next.step = step % 4;
    next.checkinCycle = (state.checkinCycle || 0) + (step % 4 === 0 ? 1 : 0);
    next.nextAt = now + schedule.checkinIntervalDays * DAY_MS;
    next.status = 'checkin';
    return next;
  }
  const sentNumber = (state.step || 0) + 1;
  if (sentNumber >= 26) {
    next.phase = 'checkin';
    next.status = 'checkin';
    next.step = 0;
    next.checkinCycle = state.checkinCycle || 0;
    next.nextAt = now + schedule.checkinIntervalDays * DAY_MS;
    return next;
  }
  next.step = sentNumber;
  next.phase = 'letters';
  next.status = 'active';
  next.nextAt = now + schedule.intervalDays * DAY_MS;
  return next;
}

export function scheduleRetry(state, now, schedule = DEFAULT_SCHEDULE) {
  const attempt = (state.attempt || 0) + 1;
  const hours = schedule.retryHours[Math.min(attempt - 1, schedule.retryHours.length - 1)] || 24;
  return { ...state, attempt, nextAt: now + hours * HOUR_MS, updatedAt: now, step: state.step, welcomeSent: state.welcomeSent };
}

/** A provider result we cannot confirm. Same letter, no step change, and a retry inside the idempotency window. */
export function letterLabel(letterKey) {
  if (letterKey === 'welcome') return { kind: 'welcome', number: null };
  const numbered = /^n(\d+)$/.exec(letterKey || '');
  if (numbered) return { kind: 'letter', number: Number(numbered[1]) };
  const checkin = /^q(\d+)-(\d+)$/.exec(letterKey || '');
  if (checkin) return { kind: 'checkin', number: Number(checkin[2]) + 1, cycle: Number(checkin[1]) };
  return { kind: 'unknown', number: null };
}

/** What an administrator may see. No letter body, archetype, or Journey answers. */
export function heldDeliveryView(delivery, state) {
  const label = letterLabel(delivery?.letterKey || delivery?.letter_key);
  return {
    email: state?.email || null,
    userId: state?.userId || delivery?.userId || null,
    letterKey: delivery?.letterKey || delivery?.letter_key || null,
    letterNumber: label.number,
    kind: label.kind,
    deliveryId: delivery?.id || delivery?.delivery_id || null,
    status: delivery?.status || null,
    attempt: state?.attempt || 0,
    firstClaimedAt: delivery?.firstClaimedAt || delivery?.first_claimed_at || null,
    uncertainAt: delivery?.uncertainAt || delivery?.uncertain_at || null,
  };
}

/**
 * A held delivery is never resent by itself.
 * mark-sent records the letter as delivered and lets the next cron advance once.
 * retry is refused unless confirmDuplicate is true, because the first attempt may already have arrived.
 */
export function resolveHeldDelivery({ decision, confirmDuplicate, now }) {
  if (decision === 'mark-sent') {
    return { ok: true, status: 'sent', nextAt: now, resend: false };
  }
  if (decision === 'retry') {
    if (confirmDuplicate !== true) return { ok: false, reason: 'confirmation required', resend: false };
    return { ok: true, status: 'released', firstClaimedAt: now, nextAt: now, resend: true, duplicatePossible: true };
  }
  return { ok: false, reason: 'decision', resend: false };
}

export function scheduleUncertain(state, now) {
  const attempt = (state.attempt || 0) + 1;
  const gaps = [1, 6, 12];
  const hours = gaps[Math.min(attempt - 1, gaps.length - 1)];
  const nextAt = now + hours * HOUR_MS;
  const started = state.deliveryClaimedAt || now;
  if (attempt > gaps.length || nextAt - started > IDEMPOTENCY_WINDOW_MS) {
    return { ...state, attempt, nextAt: null, deliveryHold: true, updatedAt: now };
  }
  return { ...state, attempt, nextAt, deliveryClaimedAt: started, updatedAt: now };
}

export function preferenceView(user, record, flags = {}) {
  const mine = record && user?.id && record.userId === user.id ? record : null;
  return {
    userId: user?.id || null,
    verified: emailVerified(user),
    status: mine?.status || 'none',
    nestCoaching: mine?.nestCoaching === true,
    productCoaching: mine ? mine.productCoaching !== false : true,
    phase: mine?.phase || null,
    step: mine?.step ?? null,
    globallyUnsubscribed: flags.suppressed === true,
    finishedWelcome: flags.finishedWelcome === true,
    needsReaffirm: flags.suppressed === true || mine?.status === 'unsubscribed',
  };
}

export function consumeIntent(map, userId) {
  if (!map || !userId || !Object.prototype.hasOwnProperty.call(map, userId)) return null;
  const choice = map[userId];
  const rest = { ...map };
  delete rest[userId];
  return { choice, rest };
}

export function createMemoryStore() {
  const states = new Map();
  const deliveries = new Map();
  let held = false;
  return {
    async withLock(fn) {
      if (held) return { acquired: false };
      held = true;
      try {
        return { acquired: true, result: await fn() };
      } finally {
        held = false;
      }
    },
    async getState(userId) {
      return states.has(userId) ? { ...states.get(userId) } : null;
    },
    async saveState(state) {
      states.set(state.userId, { ...state });
      return { ...state };
    },
    async dueStates(now) {
      return [...states.values()].filter((s) => s.nestCoaching && s.nextAt != null && s.nextAt <= now).map((s) => ({ ...s }));
    },
    async claim(id, now) {
      const row = deliveries.get(id);
      if (row?.status === 'sent') return { alreadySent: true, row };
      const started = row?.firstClaimedAt || null;
      if (started && now - started > IDEMPOTENCY_WINDOW_MS) return { held: true, row };
      if (row && (row.status === 'claimed' || row.status === 'uncertain') && now - row.claimedAt < CLAIM_TTL_MS) {
        return { inProgress: true, row };
      }
      const next = {
        id,
        status: 'claimed',
        claimedAt: now,
        firstClaimedAt: started || now,
      };
      deliveries.set(id, next);
      return { claimed: true, row: next };
    },
    async markSent(id, now) {
      const row = deliveries.get(id) || { id, firstClaimedAt: now };
      deliveries.set(id, { ...row, status: 'sent', sentAt: now });
    },
    async markFailed(id, now) {
      const row = deliveries.get(id) || { id };
      deliveries.set(id, { ...row, status: 'failed', failedAt: now });
    },
    async markUncertain(id, now) {
      const row = deliveries.get(id) || { id, firstClaimedAt: now };
      deliveries.set(id, { ...row, status: 'uncertain', uncertainAt: now, firstClaimedAt: row.firstClaimedAt || now });
    },
    snapshot() {
      return { states: [...states.values()], deliveries: [...deliveries.values()] };
    },
  };
}

export async function runTick({ store, now, schedule = DEFAULT_SCHEDULE, loadContext, send, otherMailDue, allowUser }) {
  const locked = await store.withLock(async () => {
    const due = await store.dueStates(now);
    const summary = { due: due.length, sent: 0, deferred: 0, failed: 0, repaired: 0, skipped: 0, uncertain: 0, held: 0, unrecorded: 0 };
    for (const state of due) {
      const ctx = loadContext ? await loadContext(state) : {};
      if (typeof allowUser === 'function' && !allowUser(state)) {
        summary.skipped += 1;
        continue;
      }
      if (ctx.suppressed) {
        await store.saveState({ ...state, nestCoaching: false, status: 'unsubscribed', nextAt: null, updatedAt: now });
        summary.skipped += 1;
        continue;
      }
      const dueElsewhere = typeof otherMailDue === 'function' ? await otherMailDue(state, now) : false;
      const plan = planSend({ state, now, otherMailDue: dueElsewhere });
      if (plan.action === 'defer') {
        await store.saveState({ ...state, nextAt: plan.nextAt, updatedAt: now });
        summary.deferred += 1;
        continue;
      }
      if (plan.action !== 'send') {
        summary.skipped += 1;
        continue;
      }
      const id = deliveryKey(state.userId, plan.letterKey);
      const claim = await store.claim(id, now);
      if (claim.inProgress) {
        summary.skipped += 1;
        continue;
      }
      if (claim.held) {
        await store.saveState({ ...state, nextAt: null, deliveryHold: true, updatedAt: now });
        summary.held += 1;
        continue;
      }
      if (claim.alreadySent) {
        await store.saveState(advanceAfterSend(state, now, schedule));
        summary.repaired += 1;
        continue;
      }
      let outcome;
      try {
        outcome = await send({ state, letterKey: plan.letterKey, deliveryId: id, context: ctx });
      } catch {
        outcome = { uncertain: true };
      }
      if (outcome?.uncertain) {
        await store.markUncertain(id, now);
        await store.saveState(scheduleUncertain({ ...state, deliveryClaimedAt: claim.row?.firstClaimedAt || now }, now));
        summary.uncertain += 1;
        continue;
      }
      if (!outcome || outcome.ok !== true) {
        await store.markFailed(id, now);
        await store.saveState(scheduleRetry(state, now, schedule));
        summary.failed += 1;
        continue;
      }
      try {
        await store.markSent(id, now);
      } catch {
        await store.markUncertain(id, now);
        await store.saveState(scheduleUncertain({ ...state, deliveryClaimedAt: claim.row?.firstClaimedAt || now }, now));
        summary.uncertain += 1;
        continue;
      }
      try {
        await store.saveState(advanceAfterSend(state, now, schedule));
        summary.sent += 1;
      } catch {
        summary.repaired += 0;
        summary.unrecorded += 1;
      }
    }
    return summary;
  });
  if (!locked.acquired) return { skipped: 'lock' };
  return locked.result;
}

function rowToState(row) {
  return {
    userId: row.user_id,
    email: row.email,
    nestCoaching: row.nest_coaching === true,
    productCoaching: row.product_coaching !== false,
    status: row.status,
    phase: row.phase,
    step: row.step || 0,
    checkinCycle: row.checkin_cycle || 0,
    nextAt: row.next_at ? Date.parse(row.next_at) : null,
    letterStartAt: row.letter_start_at ? Date.parse(row.letter_start_at) : null,
    welcomeSent: row.welcome_sent === true,
    attempt: row.attempt || 0,
    updatedAt: row.updated_at ? Date.parse(row.updated_at) : Date.now(),
  };
}

function stateToRow(state) {
  return {
    user_id: state.userId,
    email: state.email,
    nest_coaching: state.nestCoaching === true,
    product_coaching: state.productCoaching !== false,
    status: state.status,
    phase: state.phase,
    step: state.step || 0,
    checkin_cycle: state.checkinCycle || 0,
    next_at: state.nextAt ? new Date(state.nextAt).toISOString() : null,
    letter_start_at: state.letterStartAt ? new Date(state.letterStartAt).toISOString() : null,
    welcome_sent: state.welcomeSent === true,
    attempt: state.attempt || 0,
    updated_at: new Date(state.updatedAt || Date.now()).toISOString(),
  };
}

/** Postgres-backed store. Shared KV is not safe for this track. */
export function createSupabaseLetterStore(env, fetchImpl = fetch) {
  const base = `${env.SUPABASE_URL}/rest/v1`;
  const headers = {
    apikey: env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
  function send(path, options = {}) {
    return fetchImpl(`${base}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  }
  return {
    async withLock(fn) {
      const holder = crypto.randomUUID();
      const locked = await send('/rpc/nest_letter_try_lock', {
        method: 'POST',
        body: JSON.stringify({ p_holder: holder, p_ttl_seconds: 120 }),
      });
      const got = locked.ok && (await locked.json()) === true;
      if (!got) return { acquired: false };
      try {
        return { acquired: true, result: await fn() };
      } finally {
        await send(`/nest_letter_lock?id=eq.1&holder=eq.${encodeURIComponent(holder)}`, {
          method: 'PATCH',
          body: JSON.stringify({ expires_at: new Date(0).toISOString() }),
        });
      }
    },
    async getState(userId) {
      const res = await send(`/nest_letter_state?user_id=eq.${userId}&select=*`);
      const rows = res.ok ? await res.json() : [];
      return rows[0] ? rowToState(rows[0]) : null;
    },
    async saveState(state) {
      const res = await send('/nest_letter_state?on_conflict=user_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(stateToRow(state)),
      });
      if (!res.ok) throw new Error('Could not save letter state');
      return state;
    },
    async dueStates(now) {
      const res = await send(`/nest_letter_state?nest_coaching=eq.true&next_at=lte.${encodeURIComponent(new Date(now).toISOString())}&select=*`);
      const rows = res.ok ? await res.json() : [];
      return rows.map(rowToState);
    },
    async claim(id, now) {
      const split = id.indexOf(':');
      const existingRes = await send(`/nest_letter_deliveries?delivery_id=eq.${encodeURIComponent(id)}&select=*`);
      const existing = existingRes.ok ? (await existingRes.json())[0] : null;
      if (existing?.status === 'sent') return { alreadySent: true, row: existing };
      const started = existing?.first_claimed_at ? Date.parse(existing.first_claimed_at) : null;
      if (started && now - started > IDEMPOTENCY_WINDOW_MS) return { held: true, row: existing };
      if (existing && (existing.status === 'claimed' || existing.status === 'uncertain') && now - Date.parse(existing.claimed_at) < CLAIM_TTL_MS) {
        return { inProgress: true, row: existing };
      }
      if (!existing) {
        const body = {
          delivery_id: id,
          user_id: id.slice(0, split),
          letter_key: id.slice(split + 1),
          status: 'claimed',
          claimed_at: new Date(now).toISOString(),
          first_claimed_at: new Date(now).toISOString(),
        };
        const res = await send('/nest_letter_deliveries', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(body),
        });
        if (res.status === 201 || res.status === 200) return { claimed: true, row: { firstClaimedAt: now } };
        const again = await send(`/nest_letter_deliveries?delivery_id=eq.${encodeURIComponent(id)}&select=*`);
        const row = again.ok ? (await again.json())[0] : null;
        if (row?.status === 'sent') return { alreadySent: true, row };
        return { inProgress: true, row };
      }
      await send(`/nest_letter_deliveries?delivery_id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'claimed', claimed_at: new Date(now).toISOString() }),
      });
      return { claimed: true, row: { firstClaimedAt: started || now } };
    },
    async markSent(id, now) {
      const res = await send(`/nest_letter_deliveries?delivery_id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'sent', sent_at: new Date(now).toISOString() }),
      });
      if (!res.ok) throw new Error('Could not record the send');
    },
    async markFailed(id) {
      await send(`/nest_letter_deliveries?delivery_id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'failed' }),
      });
    },
    async markUncertain(id, now) {
      const res = await send(`/nest_letter_deliveries?delivery_id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'uncertain', uncertain_at: new Date(now).toISOString() }),
      });
      if (!res.ok) throw new Error('Could not record an uncertain send');
    },
  };
}
