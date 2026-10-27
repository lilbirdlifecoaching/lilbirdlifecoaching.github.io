/**
 * Nest email preferences and the invitation to start the coaching notes.
 * Talks only to the signed-in account. A missing endpoint leaves the Nest usable.
 */

const ENDPOINT = 'https://lilbird-assessment.cwwq46sn7m.workers.dev/nest-letters/preference';
const INTENT_KEY = 'lilbird-letters-intent';
let shownFor = null;
let dialogOpen = false;
let notice = '';

function escapeText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function preferencesDialog(view, options = {}) {
  const nestOn = view.nestCoaching === true;
  const productOn = view.productCoaching !== false;
  const open = options.open === true ? ' is-open' : '';
  const message = options.notice ? escapeText(options.notice) : '';
  return `<div class="letters-dialog${open}" role="dialog" aria-modal="true" aria-labelledby="letters-dialog-title">
<div class="letters-dialog-panel">
<h2 id="letters-dialog-title" tabindex="-1">Email preferences</h2>
<label class="letters-choice"><input type="checkbox" data-pref="nest" ${nestOn ? 'checked' : ''}> <span><strong>Nest coaching emails.</strong> Fortnightly coaching encouragement, then quarterly Life Canvas check-ins.</span></label>
<label class="letters-choice"><input type="checkbox" data-pref="product" ${productOn ? 'checked' : ''}> <span><strong>Product coaching emails.</strong> Notes around a First Flight, a coaching session, Solo, or an Intensive.</span></label>
<p class="letters-quiet">Account and security emails still arrive. These switches do not change your Nest.</p>
<p class="letters-quiet">The lil' bird letter is a separate newsletter. This page does not add or remove you. <a href="https://lilbird.beehiiv.com/" target="_blank" rel="noopener noreferrer">Manage the newsletter</a>.</p>
<p class="letters-status" role="status" data-letters-status>${message}</p>
<button type="button" class="btn btn-gold letters-done" data-letters-done>Done</button>
</div>
</div>`;
}

export function preferenceCard(view, options = {}) {
  if (!view) return '';
  if (!view.verified) {
    return '<article class="nest-letters-card" id="email-preferences"><h2>Email preferences</h2><p>Confirm your email first. Then you can choose the fortnightly notes. Your Nest is already yours.</p></article>';
  }
  const nestOn = view.nestCoaching === true;
  const needsInvite = !nestOn && (view.status === 'none' || view.status === 'declined' || view.needsReaffirm);
  let card;
  if (needsInvite) {
    const promise = view.finishedWelcome
      ? 'The last note in the welcome series said you would only hear from me if you wanted to. '
      : '';
    const prior = view.needsReaffirm
      ? 'You previously unsubscribed. Turning these on is a fresh yes. '
      : '';
    const label = view.needsReaffirm ? 'Turn coaching notes back on' : 'Send me the notes';
    card = `<article class="nest-letters-card" id="email-preferences"><h2>A little bird in your inbox</h2><p>${promise}${prior}Fortnightly coaching notes for a year, then a quarterly look at your Life Canvas. Your Nest stays either way.</p><button type="button" class="btn btn-gold" data-letters-choice="yes" data-letters-reaffirm="${view.needsReaffirm ? 'yes' : 'no'}">${label}</button><button type="button" class="btn btn-outline" data-letters-open>Email preferences</button><p class="letters-status" role="status" data-letters-invite-status></p></article>`;
  } else {
    card = `<article class="nest-letters-card" id="email-preferences"><h2>Email preferences</h2><p>Nest notes and product notes are separate. Open the switches when you want to change them.</p><button type="button" class="btn btn-outline" data-letters-open>Email preferences</button></article>`;
  }
  return card + preferencesDialog(view, options);
}

function readIntent() {
  try {
    return JSON.parse(localStorage.getItem(INTENT_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeIntent(map) {
  localStorage.setItem(INTENT_KEY, JSON.stringify(map));
}

async function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (window.__nestWorkerAuthHeaders) Object.assign(headers, await window.__nestWorkerAuthHeaders());
  return headers;
}

async function loadView(user) {
  const res = await fetch(ENDPOINT, { headers: await authHeaders() });
  if (!res.ok) return null;
  return res.json();
}

async function saveChoice(user, body) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  let payload = null;
  try { payload = await res.json(); } catch { payload = null; }
  return { ok: res.ok, payload };
}

function paint(view) {
  const host = document.getElementById('nest-letters');
  if (!host) return;
  host.innerHTML = preferenceCard(view, { open: dialogOpen, notice });
  shownFor = view?.userId || null;
  const yes = host.querySelector('[data-letters-choice="yes"]');
  if (yes) {
    yes.addEventListener('click', async () => {
      const body = { nestCoaching: true };
      if (yes.dataset.lettersReaffirm === 'yes') body.reaffirm = true;
      const saved = await saveChoice(shownFor, body);
      if (saved.ok && saved.payload?.view?.userId === shownFor) {
        notice = 'Preferences saved';
        dialogOpen = true;
        paint(saved.payload.view);
        return;
      }
      const status = host.querySelector('[data-letters-invite-status]');
      if (status) status.textContent = 'Could not save that. Try again.';
    });
  }
  host.querySelector('[data-letters-open]')?.addEventListener('click', () => {
    dialogOpen = true;
    notice = '';
    paint(view);
    host.querySelector('#letters-dialog-title')?.focus();
  });
  host.querySelector('[data-letters-done]')?.addEventListener('click', () => {
    dialogOpen = false;
    notice = '';
    paint(view);
    host.querySelector('[data-letters-open]')?.focus();
  });
  host.querySelector('.letters-dialog')?.addEventListener('click', (event) => {
    if (event.target !== event.currentTarget) return;
    dialogOpen = false;
    notice = '';
    paint(view);
  });
  host.querySelectorAll('[data-pref]').forEach((input) => {
    input.addEventListener('change', async () => {
      const status = host.querySelector('[data-letters-status]');
      if (status) status.textContent = '';
      const nest = host.querySelector('[data-pref="nest"]');
      const product = host.querySelector('[data-pref="product"]');
      const body = {
        nestCoaching: !!nest?.checked,
        productCoaching: !!product?.checked,
      };
      if (body.nestCoaching && view?.needsReaffirm) body.reaffirm = true;
      const saved = await saveChoice(shownFor, body);
      if (saved.ok && saved.payload?.view?.userId === shownFor) {
        notice = 'Preferences saved';
        dialogOpen = true;
        paint(saved.payload.view);
        return;
      }
      notice = 'Could not save that. Try again.';
      dialogOpen = true;
      paint(view);
    });
  });
  if (dialogOpen) host.querySelector('#letters-dialog-title')?.focus();
}

async function showFor(user) {
  if (!user?.id) return;
  const view = await loadView(user);
  if (!view || view.userId !== user.id) {
    paint(null);
    return;
  }
  if (view.verified && view.status === 'none') {
    const map = readIntent();
    if (Object.prototype.hasOwnProperty.call(map, user.id)) {
      const choice = map[user.id];
      delete map[user.id];
      writeIntent(map);
      const saved = await saveChoice(user, { nestCoaching: choice === 'yes' });
      if (saved.ok && saved.payload?.view?.userId === user.id) {
        notice = 'Preferences saved';
        dialogOpen = true;
        paint(saved.payload.view);
        return;
      }
    }
  }
  if (location.hash === '#email-preferences') dialogOpen = true;
  paint(view);
  if (location.hash === '#email-preferences') {
    document.getElementById('email-preferences')?.scrollIntoView({ block: 'start' });
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !dialogOpen) return;
    dialogOpen = false;
    notice = '';
    const host = document.getElementById('nest-letters');
    const opener = host?.querySelector('[data-letters-open]');
    const dialog = host?.querySelector('.letters-dialog');
    if (dialog) dialog.classList.remove('is-open');
    opener?.focus();
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('lilbird-nest-ready', (event) => {
    void showFor(event.detail?.user);
  });

  document.addEventListener('lilbird-nest-logout', () => {
    shownFor = null;
    dialogOpen = false;
    notice = '';
    const host = document.getElementById('nest-letters');
    if (host) host.innerHTML = '';
  });

  document.addEventListener('lilbird-letters-signup', (event) => {
    const user = event.detail?.user;
    if (!user?.id) return;
    const map = readIntent();
    map[user.id] = event.detail.accept ? 'yes' : 'no';
    writeIntent(map);
  });
}
