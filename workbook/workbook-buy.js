(function () {
  const WORKER_URL = 'https://worker-solo.cwwq46sn7m.workers.dev';
  const SUPABASE_URL = 'https://mebqqzbuwkogdxvnihrq.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lYnFxemJ1d2tvZ2R4dm5paHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTMzMjAsImV4cCI6MjA5MzQ4OTMyMH0.AzBotw2siyolNEbzd9cp4VT9FjBrGetiZxGOZsOGZVU';

  const sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { storageKey: 'lilbird-solo-auth', autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
  });

  const form = document.getElementById('form-account');
  const emailInput = document.getElementById('wb-email');
  const passwordInput = document.getElementById('wb-password');
  const loggedIn = document.getElementById('logged-in');
  const loggedInEmail = document.getElementById('logged-in-email');
  const errorEl = document.getElementById('form-error');
  const btnBuy = document.getElementById('btn-buy');

  let session = null;

  function setError(html) {
    errorEl.innerHTML = html || '';
  }

  function showLoggedIn(s) {
    session = s;
    const email = s?.user?.email || '';
    loggedInEmail.textContent = email;
    loggedIn.classList.toggle('hidden', !s);
    form.classList.toggle('hidden', !!s);
  }

  async function ensureAccount() {
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    if (!email || !email.includes('@') || !email.includes('.')) {
      setError('Enter your email so we can set up your Nest.');
      return null;
    }
    if (password.length < 8) {
      setError('Choose a password of at least 8 characters.');
      return null;
    }

    const signUp = await sb.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + '/nest/' } });
    if (signUp.data?.session) return signUp.data.session;

    const signIn = await sb.auth.signInWithPassword({ email, password });
    if (signIn.data?.session) return signIn.data.session;

    setError(
      'This email already has a lil\u2019 bird account. Enter that password above, or ' +
      '<a href="/nest/">open your Nest</a> and tap \u201cEmail me a link to set my password\u201d, then get the workbook from there.'
    );
    return null;
  }

  async function startCheckout() {
    setError('');
    if (!sb) {
      setError('Could not reach login just now. Please refresh and try again.');
      return;
    }
    btnBuy.disabled = true;
    btnBuy.textContent = 'Opening secure checkout…';
    try {
      const s = session || (await ensureAccount());
      if (!s) return;
      const res = await fetch(WORKER_URL + '/nest-upgrade-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token },
        body: JSON.stringify({ item: 'lcs_workbook' })
      });
      const out = await res.json().catch(() => ({}));
      if (out.url) {
        window.location.href = out.url;
        return;
      }
      if (out.already_owned) {
        window.location.href = '/nest/';
        return;
      }
      setError(res.status === 401
        ? 'Please log in again, then try once more.'
        : 'Checkout could not open just now. Please try again in a moment.');
    } catch (e) {
      console.error('Workbook checkout:', e);
      setError('Checkout could not open just now. Please try again in a moment.');
    } finally {
      btnBuy.disabled = false;
      btnBuy.textContent = 'Continue to secure payment →';
    }
  }

  btnBuy.addEventListener('click', () => void startCheckout());
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void startCheckout();
  });

  document.getElementById('btn-switch-account').addEventListener('click', async (e) => {
    e.preventDefault();
    await sb?.auth.signOut();
    showLoggedIn(null);
  });

  (async function init() {
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    if (data?.session) showLoggedIn(data.session);
  })();
})();
