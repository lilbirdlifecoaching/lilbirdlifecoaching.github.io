(function () {
  const SUPABASE_URL = 'https://mebqqzbuwkogdxvnihrq.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lYnFxemJ1d2tvZ2R4dm5paHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTMzMjAsImV4cCI6MjA5MzQ4OTMyMH0.AzBotw2siyolNEbzd9cp4VT9FjBrGetiZxGOZsOGZVU';
  const WORKER = 'https://worker-solo.cwwq46sn7m.workers.dev';
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { storageKey: 'lilbird-solo-auth', persistSession: true, autoRefreshToken: true }
  });
  const statusEl = document.getElementById('desk-status');
  const loginForm = document.getElementById('desk-login');
  const app = document.getElementById('desk-app');

  function say(text) {
    statusEl.textContent = text || '';
  }

  async function post(payload) {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Please log in again.');
    const res = await fetch(WORKER + '/desk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(payload || { action: 'home' })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'The desk could not load.');
    return body;
  }

  function paint(home) {
    const session = home.session;
    if (session) {
      const start = new Date(session.startsAt);
      const local = new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      document.getElementById('live-start').value = local;
      document.getElementById('live-url').value = session.zoomUrl || '';
      document.getElementById('live-cap').value = session.capacity || 15;
      document.getElementById('live-status').value = session.status || 'scheduled';
    }
    const roster = document.getElementById('desk-roster');
    roster.innerHTML = (home.roster || []).map((row) =>
      '<div class="desk-row"><span>' + escapeHtml(row.email || '') + '</span><span>' + escapeHtml(row.status) + (row.note ? ' · ' + escapeHtml(row.note) : '') + '</span></div>'
    ).join('') || '<p>No one has joined this live.</p>';

    const alerts = document.getElementById('desk-alerts');
    alerts.innerHTML = (home.alerts || []).map((row) =>
      '<div class="desk-row"><span><strong>' + escapeHtml(row.kind) + '</strong> · ' + escapeHtml(row.email || '') + '<br>' + escapeHtml(detailText(row.detail)) + '</span><button type="button" class="btn btn-outline" data-resolve="' + escapeHtml(row.id) + '">Done</button></div>'
    ).join('') || '<p>Nothing waiting.</p>';
    alerts.querySelectorAll('[data-resolve]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await post({ action: 'resolve', alertId: btn.getAttribute('data-resolve') });
          await load();
        } catch (e) { say(e.message); }
      });
    });

    const wait = document.getElementById('desk-wait');
    wait.innerHTML = (home.waitlist || []).map((row) =>
      '<div class="desk-row"><span>' + escapeHtml(row.email) + '</span><span>' + escapeHtml(new Date(row.created_at).toLocaleDateString()) + '</span></div>'
    ).join('') || '<p>No one has asked yet.</p>';
  }

  function detailText(detail) {
    if (!detail || typeof detail !== 'object') return '';
    if (detail.message) return detail.message;
    return Object.entries(detail).map(([k, v]) => k + ': ' + v).join(' · ');
  }

  function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function load() {
    const home = await post({ action: 'home' });
    loginForm.classList.add('hidden');
    app.classList.remove('hidden');
    document.getElementById('desk-logout').classList.remove('hidden');
    paint(home);
    say('');
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    say('Checking this login…');
    const email = document.getElementById('desk-email').value;
    const password = document.getElementById('desk-password').value;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { say(error.message); return; }
    try { await load(); } catch (err) { say(err.message); }
  });

  document.getElementById('desk-logout').addEventListener('click', async () => {
    await sb.auth.signOut({ scope: 'local' });
    app.classList.add('hidden');
    loginForm.classList.remove('hidden');
  });

  document.getElementById('desk-session').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await post({
        action: 'save-session',
        startsAt: new Date(document.getElementById('live-start').value).toISOString(),
        zoomUrl: document.getElementById('live-url').value,
        capacity: Number(document.getElementById('live-cap').value),
        status: document.getElementById('live-status').value
      });
      say('Live saved.');
      await load();
    } catch (err) { say(err.message); }
  });

  document.getElementById('desk-remove').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await post({ action: 'remove', email: document.getElementById('remove-email').value, note: document.getElementById('remove-note').value });
      say('Removed from this live.');
      await load();
    } catch (err) { say(err.message); }
  });

  document.getElementById('desk-search').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const person = await post({ action: 'search', email: document.getElementById('search-email').value });
      const box = document.getElementById('desk-person');
      if (!person.found) { box.textContent = 'No Nest on that email.'; return; }
      const products = (person.products || []).join(', ') || 'No purchases';
      const reads = (person.reads || []).map((r) => r.nestId + (r.primary ? ' (opens first)' : '')).join(', ') || 'No Compass';
      box.innerHTML = '<p>' + escapeHtml(person.email) + '</p><p>' + escapeHtml(products) + '</p><p>' + escapeHtml(reads) + '</p>' +
        (person.intensivePaidAt ? '<p>Intensive paid ' + escapeHtml(person.intensivePaidAt) + '</p>' : '');
    } catch (err) { say(err.message); }
  });

  document.getElementById('desk-merge').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const result = await post({
        action: 'merge',
        keeperEmail: document.getElementById('keep-email').value,
        otherEmail: document.getElementById('other-email').value,
        primaryNestId: document.getElementById('primary-nest').value,
        note: document.getElementById('merge-note').value
      });
      say(result.doublePlus ? 'Merged. Both Nest Plus charges are still active.' : 'Merged. The other login is closed.');
    } catch (err) { say(err.message); }
  });

  document.getElementById('desk-staff').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await post({ action: 'add-staff', email: document.getElementById('staff-email').value });
      say('Added to the desk.');
    } catch (err) { say(err.message); }
  });

  sb.auth.getSession().then(({ data }) => {
    if (data.session) load().catch((err) => say(err.message));
  });
})();
