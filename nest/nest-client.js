(function () {
  const SUPABASE_URL = 'https://mebqqzbuwkogdxvnihrq.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lYnFxemJ1d2tvZ2R4dm5paHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTMzMjAsImV4cCI6MjA5MzQ4OTMyMH0.AzBotw2siyolNEbzd9cp4VT9FjBrGetiZxGOZsOGZVU';
  const CHAT_WORKER_URL = 'https://lilbird-chat.cwwq46sn7m.workers.dev/';
  const ASSESSMENT_WORKER_URL = 'https://lilbird-assessment.cwwq46sn7m.workers.dev';
  // Optional secure endpoint for sending a Resend "Your Nest is ready" email.
  // Leave empty unless you have a backend endpoint configured.
  const SOLO_WORKER_URL = 'https://worker-solo.cwwq46sn7m.workers.dev';
  const NEST_WELCOME_EMAIL_ENDPOINT = SOLO_WORKER_URL + '/nest-welcome-email';
  const LCI_BOOKING_URL = 'https://cal.com/luke-haythorpe/life-change-session';
  const CHILDHOOD_PHOTO_BUCKET = 'childhood-photos';
  const CHILDHOOD_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

  const { createClient } = supabase;
  const AUTH_STORAGE_KEY = 'lilbird-solo-auth';
  const NEST_AUTH_REDIRECT = window.location.origin + '/nest/';
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
      storageKey: AUTH_STORAGE_KEY,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  });

  let currentUser = null;
  let entitlements = new Set();
  let nestPlusGrantedBy = '';
  let courseProfile = null;
  let sessionProgress = [];
  let deepProfile = null;
  let deepReadPaid = false;
  let canvasScores = null;
  let canvasHistory = [];
  let canvasSynthesis = '';
  let canvasTexts = null;
  let canvasView = 'arc';
  let canvasHiddenSeries = {};
  let canvasCheckinOpen = false;
  let canvasDraft = null;
  let canvasStatus = '';
  const CANVAS_DIMS = [
    { key: 'why', title: 'Passion & Purpose', color: '#F5C842', question: 'How alive does what you\'re doing feel?' },
    { key: 'who', title: 'Connections', color: '#4adea8', question: 'How held are you by the people around you?' },
    { key: 'where', title: 'Spaces', color: '#5ab4f0', question: 'Do the places you spend time fit you?' },
    { key: 'what', title: 'Resources', color: '#e8734a', question: 'Do you have what this season asks of you?' },
    { key: 'how', title: 'Energy & Wellbeing', color: '#c94aad', question: 'How is your body and your energy holding up?' }
  ];

  // Server enforces all of this; the Nest only uses it to label cards.
  const NEST_PLUS_SOURCES = [
    ['life_change_intensive', 'Included with your Intensive'],
    ['coaching', 'Included with your coaching'],
    ['first_flight', 'Included with First Flight'],
    ['nest_plus', 'Nest Plus']
  ];
  let deepNestId = null;
  let intensiveEnrolment = null;
  let lciSessions = [];
  let chatMsgs = [];
  let guideOffered = [];
  let suppressDashboard = false;
  let dashboardHydrateToken = 0;

  let signupInFlight = false;

  function resetLoginButton() {
    const btnLogin = document.getElementById('btn-login');
    if (!btnLogin) return;
    btnLogin.disabled = false;
    btnLogin.textContent = 'Log in →';
  }

  function loginErrorMessage(error) {
    if (!error) return 'Could not log in.';
    const code = String(error.code || '').toLowerCase();
    const msg = (error.message || '').toLowerCase();
    if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
      return 'Please confirm your email first (check inbox and spam), then log in. Use Resend confirmation below if needed.';
    }
    if (code === 'invalid_credentials' || msg.includes('invalid login')) {
      return 'Could not log in. If you just created an account, open the confirmation email first. Login will not work until you do. Otherwise check your password or use Forgot password.';
    }
    return error.message || 'Could not log in.';
  }

  async function resendSignupConfirmation(email) {
    const { error } = await sb.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: NEST_AUTH_REDIRECT }
    });
    return error;
  }

  function clearAllSupabaseAuthStorage() {
    const shouldRemove = (key) =>
      key.includes('lilbird') ||
      key.includes('supabase') ||
      key.startsWith('sb-') ||
      key.includes('mebqqzbuwkogdxvnihrq');

    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && shouldRemove(key)) localStorage.removeItem(key);
      }
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && shouldRemove(key)) sessionStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('Nest storage clear:', e);
    }
  }

  async function getVerifiedUser() {
    const { data, error } = await sb.auth.getUser();
    if (error || !data.user) return { user: null, error };
    return { user: data.user, error: null };
  }

  function resetLogoutButton() {
    const btnLogout = document.getElementById('btn-logout');
    if (!btnLogout) return;
    btnLogout.disabled = false;
    btnLogout.textContent = 'Log out';
  }

  function showAuthViewNow() {
    currentUser = null;
    const dash = document.getElementById('view-dashboard');
    const auth = document.getElementById('view-auth');
    const loading = document.getElementById('dash-loading');
    if (dash) dash.classList.remove('active');
    if (auth) auth.classList.add('active');
    if (loading) loading.classList.add('hidden');
    resetLogoutButton();
  }

  const urlParams = new URLSearchParams(window.location.search);
  const wantsLogout = urlParams.get('logout') === '1';

  // Nest accounts are created by a purchase (or the Inner Compass unlock), never from this page.
  const formLogin = document.getElementById('form-login');
  const formSignup = document.getElementById('form-signup');
  const formSetPassword = document.getElementById('form-set-password');
  const loginError = document.getElementById('login-error');
  const signupError = document.getElementById('signup-error');
  const setPasswordError = document.getElementById('set-password-error');
  const PW_SETUP_KEY = 'lilbird-pw-setup';
  let passwordSetupPending = false;

  function pwSetupFlag(on) {
    try {
      if (on) localStorage.setItem(PW_SETUP_KEY, '1');
      else localStorage.removeItem(PW_SETUP_KEY);
    } catch (e) {}
  }

  function pwSetupFlagSet() {
    try {
      return localStorage.getItem(PW_SETUP_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function showSignup() {
    showAuthViewNow();
    formSignup?.classList.remove('hidden');
    formLogin?.classList.add('hidden');
    formSetPassword?.classList.add('hidden');
    document.getElementById('auth-plans')?.classList.remove('hidden');
    const title = document.getElementById('auth-title');
    const copy = document.getElementById('auth-copy');
    if (title) title.innerHTML = 'Create your Nest. <em>It\'s free.</em>';
    if (copy) copy.textContent = 'This is where the lil\' bird work lives. Open a Nest for free. Add more when you want it.';
  }

  function showLogin() {
    showAuthViewNow();
    formSignup?.classList.add('hidden');
    formSetPassword?.classList.add('hidden');
    formLogin?.classList.remove('hidden');
    document.getElementById('auth-plans')?.classList.add('hidden');
    const title = document.getElementById('auth-title');
    const copy = document.getElementById('auth-copy');
    if (title) title.textContent = 'Log in to your Nest.';
    if (copy) copy.textContent = 'Pick up where you left off.';
    document.getElementById('login-email')?.focus();
  }

  function showSetPassword() {
    showAuthViewNow();
    formSignup?.classList.add('hidden');
    formLogin.classList.add('hidden');
    document.getElementById('auth-plans')?.classList.add('hidden');
    formSetPassword.classList.remove('hidden');
    const title = document.getElementById('auth-title');
    const copy = document.getElementById('auth-copy');
    if (title) title.textContent = 'Choose a password.';
    if (copy) copy.textContent = 'One last step, so you can log in to your Nest anytime.';
    setPasswordError.textContent = '';
    document.getElementById('set-password')?.focus();
  }

  document.getElementById('btn-show-login')?.addEventListener('click', showLogin);
  document.getElementById('btn-show-signup')?.addEventListener('click', showSignup);

  formSignup?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!signupError) return;
    signupError.textContent = '';
    signupError.classList.remove('auth-success');
    const email = document.getElementById('signup-email').value.trim().toLowerCase();
    const password = document.getElementById('signup-password').value;
    if (password.length < 8) {
      signupError.textContent = 'Use at least 8 characters.';
      return;
    }
    const btn = document.getElementById('btn-signup');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
    signupInFlight = true;
    try {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + '/nest/' }
      });
      if (error) {
        const msg = String(error.message || '').toLowerCase();
        signupError.textContent = msg.includes('already')
          ? 'That email already has a Nest. Log in, or use the password link if you have not set one yet.'
          : (error.message || 'Could not create the Nest. Try again.');
        return;
      }
      const acceptLetters = document.getElementById('signup-letters')?.checked === true;
      const signedUp = data?.session?.user || data?.user || null;
      if (signedUp) {
        document.dispatchEvent(new CustomEvent('lilbird-letters-signup', {
          detail: { user: signedUp, accept: acceptLetters }
        }));
      }
      if (data?.session?.user) {
        signupInFlight = false;
        await showDashboard(data.session.user);
        return;
      }
      signupError.classList.add('auth-success');
      signupError.textContent = 'Check your email to confirm this Nest, then come back and log in.';
    } catch (err) {
      console.error('Nest signup:', err);
      signupError.textContent = 'Could not create the Nest. Try again.';
    } finally {
      signupInFlight = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Create my free Nest →'; }
    }
  });

  formSetPassword.addEventListener('submit', async (e) => {
    e.preventDefault();
    setPasswordError.textContent = '';
    const pw = document.getElementById('set-password').value;
    const pw2 = document.getElementById('set-password-confirm').value;
    if (pw.length < 8) {
      setPasswordError.textContent = 'Password must be at least 8 characters.';
      return;
    }
    if (pw !== pw2) {
      setPasswordError.textContent = 'Those two passwords don’t match.';
      return;
    }
    const btn = document.getElementById('btn-set-password');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) {
        setPasswordError.textContent = error.message || 'Could not save that password. Try again.';
        return;
      }
      passwordSetupPending = false;
      pwSetupFlag(false);
      formSetPassword.classList.add('hidden');
      formLogin.classList.remove('hidden');
      await showDashboard();
    } catch (err) {
      console.error('Nest set password:', err);
      setPasswordError.textContent = 'Something went wrong. Please try again.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save password and open my Nest →';
    }
  });

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    loginError.style.color = '';
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;

    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
      btnLogin.disabled = true;
      btnLogin.textContent = 'Logging in...';
    }

    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });

      if (error) {
        loginError.textContent = loginErrorMessage(error);
        return;
      }

      if (!data.session?.user) {
        loginError.textContent =
          'Account needs email confirmation before login. Check your inbox, then try again.';
        return;
      }

      pwSetupFlag(false);
      await showDashboard(data.session.user);
    } catch (err) {
      console.error('Nest login:', err);
      loginError.textContent = 'Something went wrong. Please try again.';
    } finally {
      resetLoginButton();
    }
  });

  document.getElementById('btn-forgot').addEventListener('click', async () => {
    loginError.textContent = '';
    loginError.style.color = '';
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    if (!email) {
      loginError.textContent = 'Enter your email above first, then tap this again.';
      return;
    }
    const btn = document.getElementById('btn-forgot');
    btn.disabled = true;
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: NEST_AUTH_REDIRECT
    });
    btn.disabled = false;
    if (!error) pwSetupFlag(true);
    loginError.style.color = error ? '' : 'var(--gold)';
    loginError.textContent = error
      ? (error.message || 'Could not send the email. Try again in a minute.')
      : 'Check your email (and spam) for a link from lil’ bird. It brings you back here to choose your password.';
  });

  const btnResendConfirm = document.getElementById('btn-resend-confirm');
  if (btnResendConfirm) btnResendConfirm.addEventListener('click', async () => {
    loginError.textContent = '';
    loginError.style.color = '';
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    if (!email) {
      loginError.textContent = 'Enter your email first, then resend confirmation.';
      return;
    }
    const btn = document.getElementById('btn-resend-confirm');
    if (btn) btn.disabled = true;
    const error = await resendSignupConfirmation(email);
    if (btn) btn.disabled = false;
    loginError.style.color = error ? '' : 'var(--gold)';
    loginError.textContent = error
      ? error.message || 'Could not resend confirmation.'
      : 'Confirmation email sent. Check your inbox and spam, then click the link (it should open this Nest page).';
  });

  async function workerAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const { data: { session } } = await sb.auth.getSession();
    if (session?.access_token) headers.Authorization = 'Bearer ' + session.access_token;
    return headers;
  }

  window.__nestWorkerAuthHeaders = workerAuthHeaders;

  async function sendNestWelcomeEmail(email, name) {
    if (!NEST_WELCOME_EMAIL_ENDPOINT) return;
    try {
      await fetch(NEST_WELCOME_EMAIL_ENDPOINT, {
        method: 'POST',
        headers: await workerAuthHeaders(),
        body: JSON.stringify({ name })
      });
    } catch (e) {
      console.error('Nest welcome email failed:', e);
    }
  }

  function setDashError(message) {
    const el = document.getElementById('dash-error');
    if (!message) {
      el.textContent = '';
      el.classList.add('hidden');
      return;
    }
    el.textContent = message;
    el.classList.remove('hidden');
  }

  function setDashLoading(isLoading) {
    document.getElementById('dash-loading').classList.toggle('hidden', !isLoading);
  }

  async function hydrateDashboard() {
    if (!currentUser?.id) return;

    const uid = currentUser.id;
    const token = ++dashboardHydrateToken;
    setDashError('');
    setDashLoading(true);

    try {
      const [entRes, courseRes, progressRes, linkRes, intensiveRes, lciRes] = await Promise.all([
        sb.from('user_entitlements').select('product,active,granted_by').eq('user_id', uid).eq('active', true),
        sb.from('course_users').select('*').eq('id', uid).maybeSingle(),
        sb.from('session_progress').select('*').eq('user_id', uid).order('session_number'),
        sb.from('deep_profile_links').select('nest_id').eq('user_id', uid).maybeSingle(),
        sb.from('intensive_enrolments').select('*').eq('user_id', uid).maybeSingle(),
        sb.from('lci_sessions').select('*').eq('user_id', uid).order('session_number')
      ]);

      if (entRes.error) {
        const detail = entRes.error.message || entRes.error.code || 'unknown error';
        setDashError(
          'Could not load your product access (' + detail + '). In Supabase, confirm user_entitlements exists and RLS select policy allows authenticated users.'
        );
        console.error('user_entitlements query failed:', entRes.error);
      }

      entitlements = new Set((entRes.data || []).map((r) => r.product));
      nestPlusGrantedBy = (entRes.data || []).find((r) => r.product === 'nest_plus')?.granted_by || '';
      courseProfile = courseRes.data || null;
      sessionProgress = progressRes.data || [];
      deepNestId = linkRes.data?.nest_id || null;
      intensiveEnrolment = intensiveRes.data || null;
      lciSessions = lciRes.data || [];
      if (lciRes.error) {
        console.warn('lci_sessions query:', lciRes.error);
      }

      if (entitlements.has('life_change_intensive') && !lciSessions.length && !lciRes.error) {
        const initRes = await sb.rpc('initialise_lci_sessions', { p_user_id: uid });
        if (initRes.error) {
          console.warn('initialise_lci_sessions:', initRes.error);
        } else {
          const refetch = await sb
            .from('lci_sessions')
            .select('*')
            .eq('user_id', uid)
            .order('session_number');
          if (!refetch.error && refetch.data?.length) {
            lciSessions = refetch.data;
          }
        }
      }

      deepProfile = null;
      deepReadPaid = false;
      canvasScores = null;
      canvasHistory = [];
      canvasSynthesis = '';
      canvasTexts = null;

      if (deepNestId) {
        try {
          const res = await fetch(ASSESSMENT_WORKER_URL + '/get-profile?nestId=' + encodeURIComponent(deepNestId), {
            headers: await authHeaders()
          });
          if (res.ok) {
            const payload = await res.json();
            deepProfile = parseAssessmentProfile(payload);
            deepReadPaid = payload?.paid === true;
            applyCanvasPayload(payload);
          }
        } catch (e) {
          console.error('Could not load deep profile:', e);
        }
      }

      document.getElementById('nav-user-name').textContent =
        courseProfile?.full_name || currentUser.user_metadata?.full_name || currentUser.email;

      document.getElementById('profile-dot').classList.toggle('hidden', !hasInnerCompassComplete());
      updateNavAvatar();
      renderNextSteps();
      renderProducts();
      renderProfile();
      renderLifeCanvas();
      renderSidebar();
      refreshJourney();
      window.__nestAccess = nestAccessSummary();
      if (window.LilBirdNestTour) {
        window.LilBirdNestTour.bindReplayButton();
        const forceTour = new URLSearchParams(window.location.search).get('tour') === '1';
        if (forceTour) {
          window.LilBirdNestTour.startForced();
        } else {
          window.LilBirdNestTour.maybeAutoStart();
        }
      }
      void handlePurchaseReturn();
      const arrival = new URLSearchParams(window.location.search);
      if (!arrival.get('tab') && !arrival.get('tool') && hasNestPlus()) setTab('ask');
      else syncGuideAccess();
      document.dispatchEvent(new CustomEvent('lilbird-nest-ready', { detail: { user: currentUser } }));
    } catch (err) {
      console.error('Nest hydrateDashboard:', err);
      if (token === dashboardHydrateToken) {
        setDashError('Could not load your Nest. Please refresh the page or try again.');
      }
    } finally {
      if (token === dashboardHydrateToken) setDashLoading(false);
    }
  }

  async function authHeaders() {
    try {
      const { data } = await sb.auth.getSession();
      const token = data?.session?.access_token;
      return token ? { Authorization: 'Bearer ' + token } : {};
    } catch (e) {
      return {};
    }
  }

  function nestPlusIsSubscription() {
    return String(nestPlusGrantedBy || '').indexOf('stripe_sub:') === 0;
  }

  function nestPlusSource() {
    const hit = NEST_PLUS_SOURCES.find(([key]) => entitlements.has(key));
    return hit ? hit[1] : '';
  }

  function hasNestPlus() {
    return !!nestPlusSource();
  }

  function workbookSource() {
    if (entitlements.has('life_change_intensive')) return 'Included with your Intensive';
    if (entitlements.has('lcs_workbook')) return 'Yours to keep';
    return '';
  }

  function hasWorkbookAccess() {
    return !!workbookSource();
  }

  function planInfo() {
    if (entitlements.has('life_change_intensive')) {
      return { name: 'Intensive', note: 'Your Intensive includes everything in your Nest.' };
    }
    if (hasNestPlus()) {
      const src = nestPlusSource();
      return { name: 'Nest Plus', note: src === 'Nest Plus' ? 'Full read, Life Canvas, Relationship Dynamic, and the Roots & Wings workbook. $7.99 a month.' : src + '.' };
    }
    return { name: 'Nest', note: 'First Flight workbook, Glow Map, and quizzes. Nest Plus adds the full read, Life Canvas, Relationship Dynamic, and Roots & Wings.' };
  }

  function nestAccessSummary() {
    const owned = [];
    if (deepReadPaid) owned.push('full_read');
    if (hasNestPlus()) owned.push('nest_plus');
    if (hasWorkbookAccess()) owned.push('lcs_workbook');
    if (hasSoloCourseAccess()) owned.push('solo_course');
    if (entitlements.has('first_flight')) owned.push('first_flight');
    if (entitlements.has('life_change_intensive')) owned.push('life_change_intensive');
    return { owned, plan: planInfo().name, nestPlusSource: nestPlusSource(), workbookSource: workbookSource() };
  }

  async function startUpgrade(item, btn) {
    const original = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Opening secure checkout…';
    }
    setDashError('');
    try {
      const res = await fetch(SOLO_WORKER_URL + '/nest-upgrade-checkout', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, await authHeaders()),
        body: JSON.stringify({ item })
      });
      const out = await res.json().catch(() => ({}));
      if (out.url) {
        window.location.href = out.url;
        return;
      }
      if (out.already_owned) {
        await hydrateDashboard();
        return;
      }
      setDashError(res.status === 401 ? 'Please log in again, then try once more.' : 'Checkout could not open just now. Please try again in a moment.');
    } catch (e) {
      console.error('startUpgrade:', e);
      setDashError('Checkout could not open just now. Please try again in a moment.');
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  async function openNestPlusBilling(btn) {
    const original = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Opening billing…';
    }
    setDashError('');
    try {
      const res = await fetch(SOLO_WORKER_URL + '/nest-plus-billing', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, await authHeaders()),
        body: '{}'
      });
      const out = await res.json().catch(() => ({}));
      if (out.url) {
        window.location.href = out.url;
        return;
      }
      setDashError(out.legacy
        ? 'This Nest Plus was a one-time purchase, so there is no monthly bill to manage.'
        : 'Billing could not open just now. Email hello@lilbird.life and we will sort it.');
    } catch (e) {
      console.error('openNestPlusBilling:', e);
      setDashError('Billing could not open just now. Email hello@lilbird.life and we will sort it.');
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  let purchasePolls = 0;
  async function handlePurchaseReturn() {
    const params = new URLSearchParams(window.location.search);
    const item = params.get('purchase');
    if (item !== 'nest_plus' && item !== 'lcs_workbook') return;
    const unlocked = item === 'nest_plus' ? hasNestPlus() : hasWorkbookAccess();
    if (unlocked || purchasePolls >= 8) {
      params.delete('purchase');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
      if (!unlocked) {
        setDashError('Payment received. Your unlock is still on its way. Refresh in a minute, or email hello@lilbird.life if it does not appear.');
      }
      return;
    }
    purchasePolls += 1;
    setDashError('Payment received. Unlocking now…');
    setTimeout(() => void hydrateDashboard(), 2500);
  }

  /** Solo unlock: Nest entitlement row and/or legacy course_users purchase (same Supabase login). */
  function hasSoloCourseAccess() {
    return entitlements.has('solo_course') || !!courseProfile?.purchased_at;
  }

  function intensiveProgressFlags() {
    const hasIntensive = entitlements.has('life_change_intensive');
    const paidDone = hasIntensive || !!intensiveEnrolment?.paid_at;
    const contractDone = paidDone || !!intensiveEnrolment?.contract_signed_at;
    return { paidDone, contractDone };
  }

  function lciStats() {
    const total = 8;
    if (!lciSessions.length) {
      return { total, booked: 0, remaining: total, allBooked: false, hasRows: false, nextAvailable: null };
    }
    const booked = lciSessions.filter((s) => s.status === 'booked' || s.status === 'completed').length;
    const remaining = lciSessions.filter((s) => s.status === 'available').length;
    const nextAvailable = lciSessions.find((s) => s.status === 'available') || null;
    return {
      total,
      booked,
      remaining,
      allBooked: remaining === 0,
      hasRows: true,
      nextAvailable
    };
  }

  function formatLciSessionDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch (e) {
      return '—';
    }
  }

  function renderLciBookingSection() {
    const stats = lciStats();
    const pct = stats.hasRows ? Math.round((stats.booked / stats.total) * 100) : 0;

    let sessionRows = '';
    if (stats.hasRows) {
      const nextNum = stats.nextAvailable?.session_number;
      sessionRows = lciSessions
        .map((s) => {
          const isBooked = s.status === 'booked' || s.status === 'completed';
          const isNext = !isBooked && s.session_number === nextNum;
          const dateStr = isBooked ? formatLciSessionDate(s.session_date) : '—';
          let badge = '';
          if (isBooked) badge = '<span class="lci-badge booked">Booked</span>';
          else if (isNext) badge = '<span class="lci-badge next">Up next</span>';
          return `<li class="lci-session-row${isNext ? ' is-next' : ''}${isBooked ? ' is-booked' : ''}">
            <span class="lci-session-num">Session ${s.session_number}</span>
            <span class="lci-session-date">${escapeHtml(dateStr)}</span>
            ${badge}
          </li>`;
        })
        .join('');
    } else {
      sessionRows =
        '<li class="lci-session-empty">Session slots are being set up. Refresh in a moment or email hello@lilbird.life.</li>';
    }

    let bookingAction = '';
    if (stats.hasRows && stats.remaining > 0) {
      bookingAction = `<a class="btn btn-gold" href="${escapeHtml(LCI_BOOKING_URL)}" target="_blank" rel="noopener">Book your next session →</a>`;
    } else if (stats.hasRows && stats.allBooked) {
      bookingAction =
        '<p class="lci-complete">All sessions booked. Reach out to Luke at <a href="mailto:hello@lilbird.life">hello@lilbird.life</a> if you need anything.</p>';
    }

    const syncHint =
      stats.hasRows && stats.remaining > 0
        ? '<p class="lci-sync-hint">Just booked on Cal.com? Tap below if your count did not update.</p>'
        : '';

    const syncButton =
      stats.hasRows && stats.remaining > 0
        ? '<button type="button" class="btn btn-outline" id="btn-lci-claim">Update my session count</button>'
        : '';

    return `
      <p class="lci-counter">Sessions remaining: <strong>${stats.remaining}</strong> of ${stats.total}</p>
      <div class="progress lci-progress"><div class="progress-fill" style="width:${pct}%"></div></div>
      <ul class="lci-session-list">${sessionRows}</ul>
      ${syncHint}
      <div class="btn-row">
        ${bookingAction}
        ${syncButton}
        <a class="btn btn-outline" href="${workbookHref('life-change')}">Open workbook</a>
      </div>`;
  }

  async function claimNextLciSession(btn) {
    if (!currentUser?.id) return;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Updating…';
    setDashError('');

    try {
      const { data, error } = await sb.rpc('claim_next_lci_session');
      if (error) {
        setDashError(
          error.message === 'no available sessions'
            ? 'No sessions left to mark. You may already be up to date.'
            : 'Could not update your session count. Try refreshing, or email hello@lilbird.life.'
        );
        return;
      }
      await hydrateDashboard();
      const num = data?.session_number;
      if (num) {
        btn.textContent = `Session ${num} marked booked ✓`;
        setTimeout(() => {
          btn.textContent = original;
          btn.disabled = false;
        }, 2500);
        return;
      }
    } catch (e) {
      console.error('claim_next_lci_session:', e);
      setDashError('Could not update your session count. Try refreshing.');
    }

    btn.textContent = original;
    btn.disabled = false;
  }

  function renderNextSteps() {
    const steps = [];
    const hasInner = hasInnerCompassAccess();
    const innerDone = hasInnerCompassComplete();
    const hasSolo = hasSoloCourseAccess();
    const hasFirstFlight = entitlements.has('first_flight');
    const hasIntensive = entitlements.has('life_change_intensive');

    if (hasIntensive) {
      const { contractDone, paidDone } = intensiveProgressFlags();
      const stats = lciStats();
      steps.push({ done: contractDone, text: contractDone ? 'Agreement signed' : 'Sign the coaching agreement', href: '/intensive/enrol.html?from=nest' });
      steps.push({ done: paidDone, text: paidDone ? 'Payment confirmed' : 'Complete Intensive payment', href: '/intensive/enrol.html?from=nest' });
      steps.push({
        done: stats.hasRows && stats.allBooked,
        text: stats.allBooked
          ? 'All 8 sessions booked'
          : stats.hasRows
            ? `Book your next session (${stats.remaining} of 8 remaining)`
            : 'Book sessions from your Intensive card',
        href: stats.allBooked ? '' : LCI_BOOKING_URL,
        external: true
      });
      steps.push({ done: paidDone, text: 'Open Roots & Wings workbook before session one', href: workbookHref('life-change') });
      if (!youngerYouPhotoUrl()) {
        steps.push({ done: false, text: 'Add your Nest picture on Inner Compass', action: 'photo' });
      }
    } else {
      steps.push({
        done: innerDone,
        text: innerDone
          ? 'Inner Compass completed'
          : hasInner
            ? 'Take your Inner Compass assessment'
            : 'Take your free Inner Compass',
        href: innerDone ? innerCompassHref() : '/inner-compass/?from=nest'
      });
      steps.push({
        done: hasFirstFlight,
        text: hasFirstFlight
          ? 'First Flight booked'
          : 'Book a First Flight session · $149',
        href: hasFirstFlight ? '' : '/first-flight/book.html?code=IMREADY'
      });
      steps.push({
        done: false,
        text: 'Or book a single coaching session · $249',
        href: '/coaching/book.html?from=nest'
      });
      steps.push({
        done: hasIntensive,
        text: 'Or enrol in the Life Change Intensive',
        href: '/intensive/enrol.html?from=nest'
      });
      if (hasSolo) {
        steps.push({ done: false, text: 'Continue Solo', href: '/solo/' });
      }
      steps.push({
        done: !!youngerYouPhotoUrl(),
        text: youngerYouPhotoUrl()
          ? 'Nest picture added'
          : 'Add your Nest picture on Inner Compass',
        action: youngerYouPhotoUrl() ? '' : 'photo'
      });
    }

    const ul = document.getElementById('next-steps-list');
    ul.innerHTML = steps
      .map((s) => {
        const label = `${s.done ? '✓' : '○'} ${escapeHtml(s.text)}`;
        if (s.href) {
          const ext = s.external ? ' target="_blank" rel="noopener"' : '';
          return `<li class="${s.done ? 'done' : ''}"><a class="step-link" href="${escapeHtml(s.href)}"${ext}>${label} →</a></li>`;
        }
        if (s.action === 'photo') {
          return `<li><button type="button" class="step-link" data-step-photo>${label} →</button></li>`;
        }
        return `<li class="${s.done ? 'done' : ''}">${label}</li>`;
      })
      .join('');
    ul.querySelectorAll('[data-step-photo]').forEach((btn) => btn.addEventListener('click', goToPhoto));
  }

  function parseAssessmentProfile(payload) {
    if (!payload || typeof payload !== 'object') return null;
    if (payload.profile && typeof payload.profile === 'object') return payload.profile;
    if (payload.archetype || payload.mbti || payload.archetypePlain) return payload;
    return null;
  }

  function extractNestIdFromInput(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    try {
      const u = new URL(s, window.location.origin);
      const n = u.searchParams.get('nest');
      if (n) return n.trim();
    } catch (_) {
      /* not a full URL */
    }
    const m = s.match(/[?&]nest=([^&]+)/i);
    if (m) return decodeURIComponent(m[1]).trim();
    return s.replace(/^nest[:\s]+/i, '').trim();
  }

  async function fetchAssessmentProfile(nestId) {
    const res = await fetch(
      ASSESSMENT_WORKER_URL + '/get-profile?nestId=' + encodeURIComponent(nestId),
      { headers: await authHeaders() }
    );
    if (!res.ok) return null;
    const payload = await res.json();
    return parseAssessmentProfile(payload);
  }

  async function linkInnerCompassToAccount(btn) {
    const hint =
      'Paste your Inner Compass results link from email\n(for example: lilbird.life/inner-compass/?nest=…)\n\nOr paste the nest id only:';
    const raw = window.prompt(hint, '');
    if (raw == null) return;

    const nestId = extractNestIdFromInput(raw);
    if (!nestId) {
      setDashError('Could not read a nest id from that text. Use your full results link from email.');
      return;
    }

    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Checking your read…';
    setDashError('');

    try {
      const profile = await fetchAssessmentProfile(nestId);
      if (!profile) {
        setDashError(
          'That link did not load a saved read. Open it in a new tab. If it works there, copy the full URL again. The email on the assessment can differ from your Nest login; that is OK.'
        );
        return;
      }

      btn.textContent = 'Connecting…';
      const { error } = await sb.rpc('link_deep_profile_to_user', { p_nest_id: nestId });
      if (error) {
        setDashError(
          error.message.includes('another account')
            ? 'That read is already connected to a different Nest account.'
            : 'Could not save the link. Try again or email hello@lilbird.life.'
        );
        return;
      }

      deepNestId = nestId;
      deepProfile = profile;

      await hydrateDashboard();
      if (hasInnerCompassComplete()) {
        btn.textContent = 'Connected ✓';
        setTimeout(() => {
          btn.textContent = original;
          btn.disabled = false;
        }, 2500);
        return;
      }
      setDashError('Link saved. Refresh the page if your profile does not appear.');
    } catch (e) {
      console.error('link_deep_profile_to_user:', e);
      setDashError('Could not connect your results. Try again or email hello@lilbird.life.');
    }

    btn.textContent = original;
    btn.disabled = false;
  }

  function hasInnerCompassAccess() {
    return entitlements.has('inner_compass') || hasInnerCompassComplete() || hasNestPlus();
  }

  function hasInnerCompassComplete() {
    return !!(deepNestId && deepProfile);
  }

  function innerCompassHref() {
    const base = '/inner-compass/';
    if (hasInnerCompassComplete() && deepNestId) {
      return (
        base +
        '?nest=' +
        encodeURIComponent(deepNestId) +
        '&from=nest'
      );
    }
    return base + '?from=nest';
  }

  function openInnerCompassRead() {
    if (hasInnerCompassComplete()) {
      window.location.href = innerCompassHref();
      return;
    }
    setTab('profile');
  }

  function innerCompassSnapshot(profile) {
    if (!profile) return null;
    const headline =
      profile.archetypePlain ||
      profile.likelyCoreArchetypePlain ||
      profile.archetype ||
      profile.likelyCoreArchetype ||
      'Your Inner Compass';
    let blurb =
      profile.archetypePlainDescription ||
      profile.archetypeSub ||
      profile.bridge ||
      profile.quote ||
      '';
    blurb = String(blurb).trim();
    if (blurb.length > 180) blurb = blurb.slice(0, 177).trim() + '…';

    const parts = [];
    const mbti = profile.mbti || profile.likelyCoreMbti;
    const enne = profile.enneagram || profile.likelyCoreEnneagram;
    const att = profile.attachment || profile.likelyCoreAttachment;
    if (mbti) parts.push(String(mbti).trim());
    if (enne) parts.push(String(enne).trim());
    if (att) parts.push(String(att).trim());

    return { headline, blurb, typeLine: parts.join(' · ') };
  }

  function renderInnerCompassSnapshotMarkup(variant) {
    const snap = innerCompassSnapshot(deepProfile);
    if (!snap) return '';
    const href = innerCompassHref();
    const kicker = variant === 'profile' ? 'Your wiring' : 'Inner Compass';
    const blurbHtml = snap.blurb
      ? `<p class="ic-snap-blurb">${escapeHtml(snap.blurb)}</p>`
      : '';
    const typesHtml = snap.typeLine
      ? `<p class="ic-snap-types">${escapeHtml(snap.typeLine)}</p>`
      : '';

    return `
      <a class="ic-snap-link" href="${escapeHtml(href)}">
        <p class="ic-snap-kicker">${escapeHtml(kicker)}</p>
        <h3 class="ic-snap-headline">${escapeHtml(snap.headline)}</h3>
        ${blurbHtml}
        ${typesHtml}
        <span class="ic-snap-cta">${deepReadPaid ? 'Open your full read →' : 'Open your read · unlock the full read for $2 →'}</span>
      </a>`;
  }

  function workbookHref(key) {
    return '/workbooks/view.html?w=' + key;
  }

  function progressSummary() {
    if (!sessionProgress.length) return { pct: 0, next: 'Session 0 · First Flight' };
    const complete = sessionProgress.filter((s) => s.status === 'complete').length;
    const pct = Math.round((complete / 8) * 100);
    const next = sessionProgress.find((s) => s.status === 'available' || s.status === 'in_progress');
    const nextName = next ? `Session ${next.session_number}` : 'All sessions complete';
    return { pct, next: nextName };
  }

  function cardProduct(key) {
    const unlocked = entitlements.has(key);
    if (key === 'inner_compass') {
      const done = hasInnerCompassComplete();
      const hasAccess = hasInnerCompassAccess();
      const connectBlock = done
        ? ''
        : `<p class="inner-compass-link-hint">Already finished? Paste the link from your results email (the part with <code>?nest=…</code>). Your Nest email can differ from the assessment email.</p>
            <div class="btn-row inner-compass-connect-row">
              <button type="button" class="btn btn-outline" id="btn-link-inner-compass">Connect my results</button>
            </div>`;

      if (hasAccess) {
        if (done) {
          return `
          <article class="product-card ic-snapshot-card" data-product="inner_compass">
            ${renderInnerCompassSnapshotMarkup('dashboard')}
          </article>`;
        }
        return `
          <article class="product-card" data-product="inner_compass">
            <p class="eyebrow">assessment</p>
            <h3>Inner Compass read</h3>
            <span class="status-badge pending">ready to begin</span>
            <p>You have access. Take the assessment to generate your personal read.</p>
            ${connectBlock}
            <div class="btn-row">
              <a class="btn btn-gold" href="${innerCompassHref()}">Take the Inner Compass →</a>
            </div>
          </article>`;
      }
      return `
        <article class="product-card" data-product="inner_compass">
          <p class="eyebrow">assessment</p>
          <h3>Inner Compass read</h3>
          <span class="status-badge pending">free · about 15 minutes</span>
          <p>Understand your wiring. The foundation everything else builds on. Your two types are free; the full read is $2.</p>
          ${connectBlock}
          <div class="btn-row"><a class="btn btn-ember" href="/inner-compass/?from=nest">Take the Inner Compass →</a></div>
        </article>`;
    }

    if (key === 'nest_plus') {
      const src = nestPlusSource();
      const readLink = deepNestId ? '/relationship-dynamic.html?nest=' + encodeURIComponent(deepNestId) + '&from=nest' : '/relationship-dynamic.html?from=nest';
      if (src) {
        return `
          <article class="product-card" data-product="nest_plus">
            <p class="eyebrow">nest plus</p>
            <h3>The Intensive workbook, on your own time</h3>
            <span class="status-badge">${escapeHtml(src)}</span>
            <p>lil' bird guide is the next best thing to being in the room with Luke. Life Canvas, the full Inner Compass read, Relationship Dynamic, and the Roots &amp; Wings workbook are here too.</p>
            <div class="btn-row">
              <button type="button" class="btn btn-gold" data-open-canvas>Life Canvas →</button>
              <a class="btn btn-outline" href="${workbookHref('life-change')}">Roots &amp; Wings</a>
              <a class="btn btn-outline" href="${escapeHtml(readLink)}">Relationship Dynamic</a>
              ${nestPlusIsSubscription() ? '<button type="button" class="btn btn-outline" data-manage-plus>Manage billing</button>' : ''}
            </div>
          </article>`;
      }
      return `
        <article class="product-card locked" data-product="nest_plus">
          <span class="lock-pill"><i class="ti ti-lock"></i> $7.99/month</span>
          <p class="eyebrow">nest plus</p>
          <h3>The Intensive workbook, on your own time</h3>
          <p>The next best thing to being in the room with Luke. Life Canvas, the full Inner Compass read, Relationship Dynamic, and the Roots &amp; Wings workbook are here too. Cancel anytime. Included with coaching or the Intensive.</p>
          <div class="btn-row"><button type="button" class="btn btn-ember" data-upgrade="nest_plus">Add Nest Plus · $7.99/month →</button></div>
        </article>`;
    }

    if (key === 'lcs_workbook') {
      if (hasNestPlus()) return '';
      const src = workbookSource();
      if (!src) return '';
      return `
        <article class="product-card" data-product="lcs_workbook">
          <p class="eyebrow">workbook</p>
          <h3>Roots &amp; Wings</h3>
          <span class="status-badge">${escapeHtml(src)}</span>
          <p>Eight sessions in one workbook. Answers save on this device. Download as PDF keeps a copy.</p>
          <div class="btn-row"><a class="btn btn-gold" href="${workbookHref('life-change')}">Open workbook →</a></div>
        </article>`;
    }

    if (key === 'free_workbook') {
      return `
        <article class="product-card" data-product="free_workbook">
          <p class="eyebrow">free · already yours</p>
          <h3>First Flight workbook</h3>
          <p>Map what's going on and pick one next move.</p>
          <div class="btn-row"><a class="btn btn-gold" href="${workbookHref('first-flight')}">Open workbook →</a></div>
        </article>`;
    }

    if (key === 'first_flight') {
      if (unlocked) {
        return `
          <article class="product-card" data-product="first_flight">
            <p class="eyebrow">1-to-1 coaching</p>
            <h3>First Flight session</h3>
            <span class="status-badge">booked</span>
            <p>Fill in your workbook before your session. It saves privately to your device.</p>
            <div class="btn-row">
              <a class="btn btn-gold" href="${workbookHref('first-flight')}">Open workbook</a>
              <a class="btn btn-outline" href="mailto:hello@lilbird.life?subject=My%20First%20Flight">Email Luke</a>
            </div>
          </article>`;
      }
      return `
        <article class="product-card locked" data-product="first_flight">
          <span class="lock-pill"><i class="ti ti-lock"></i> not yet unlocked</span>
          <p class="eyebrow">1-to-1 coaching</p>
          <h3>First Flight session</h3>
          <p>Book a single session with Luke from your Nest and bring your Inner Compass read to talk through.</p>
          <div class="btn-row"><a class="btn btn-ember" href="/first-flight/book.html?code=IMREADY">Book First Flight · $149 →</a></div>
        </article>`;
    }

    if (key === 'coaching') {
      const email = encodeURIComponent(currentUser?.email || '');
      const name = encodeURIComponent(courseProfile?.full_name || currentUser?.user_metadata?.full_name || '');
      const href = `/coaching/book.html?from=nest${email ? `&email=${email}` : ''}${name ? `&name=${name}` : ''}`;
      return `
        <article class="product-card" data-product="coaching">
          <p class="eyebrow">à la carte</p>
          <h3>Coaching session</h3>
          <p>One focused session when something specific needs working through. Book anytime from your Nest, no package required.</p>
          <div class="btn-row"><a class="btn btn-ember" href="${href}">Book coaching · $249 →</a></div>
        </article>`;
    }

    if (key === 'solo_course') {
      const soloUnlocked = hasSoloCourseAccess();
      if (soloUnlocked) {
        const p = progressSummary();
        if (p.pct >= 100) {
          return `
          <article class="product-card" data-product="solo_course">
            <span class="status-badge">complete</span>
            <p class="eyebrow">self-guided course</p>
            <h3>Life Change Sessions: Solo</h3>
            <p>8/8 sessions · your Full Flight Plan is ready when you are.</p>
            <div class="progress"><div class="progress-fill" style="width:100%"></div></div>
            <div class="btn-row">
              <a class="btn btn-gold" href="/solo/?view=plan">Your Flight Plan →</a>
              <a class="btn btn-outline" href="/solo/?view=sessions">Revisit sessions</a>
            </div>
          </article>`;
        }
        return `
          <article class="product-card" data-product="solo_course">
            <p class="eyebrow">self-guided course</p>
            <h3>Life Change Sessions: Solo</h3>
            <p>${p.pct}% complete · next up: ${escapeHtml(p.next)}</p>
            <div class="progress"><div class="progress-fill" style="width:${p.pct}%"></div></div>
            <div class="btn-row"><a class="btn btn-gold" href="/solo/">Continue →</a></div>
          </article>`;
      }
      return `
        <article class="product-card locked" data-product="solo_course">
          <span class="lock-pill"><i class="ti ti-lock"></i> not yet unlocked</span>
          <p class="eyebrow">self-guided course</p>
          <h3>Life Change Sessions: Solo</h3>
          <p>Eight sessions at your own pace. An AI coaching guide that helps you see yourself again.</p>
          <div class="btn-row"><a class="btn btn-ember" href="/solo/">Unlock · $197 →</a></div>
        </article>`;
    }

    if (key === 'life_change_intensive') {
      if (unlocked) {
        return `
          <article class="product-card" data-product="life_change_intensive">
            <p class="eyebrow">full programme</p>
            <h3>Life Change Intensive</h3>
            <span class="status-badge">active</span>
            <p>Book one session at a time. Your Nest tracks all 8.</p>
            ${renderLciBookingSection()}
          </article>`;
      }
      return `
        <article class="product-card locked" data-product="life_change_intensive">
          <span class="lock-pill"><i class="ti ti-lock"></i> not yet unlocked</span>
          <p class="eyebrow">full programme</p>
          <h3>Life Change Intensive</h3>
          <p>Eight sessions with Luke. Enrol from your Nest: read the agreement, pay securely, then book session by session here.</p>
          <div class="btn-row">
            <a class="btn btn-ember" href="/intensive/enrol.html?from=nest">Enrol: read agreement &amp; pay →</a>
            <button class="btn btn-outline" data-open-ask>Ask a question</button>
          </div>
        </article>`;
    }
    return '';
  }

  function renderProducts() {
    const productsPane = document.getElementById('pane-products');
    const plan = planInfo();
    productsPane.innerHTML = `<div class="product-grid">
      <div class="plan-badge" data-plan="${escapeHtml(plan.name)}">
        <span class="plan-badge-label">Your plan</span>
        <strong class="plan-badge-name">${escapeHtml(plan.name)}</strong>
        <span class="plan-badge-note">${escapeHtml(plan.note)}</span>
      </div>
      ${renderPhotoPrompt()}
      ${cardProduct('free_workbook')}
      ${cardProduct('inner_compass')}
      ${cardProduct('nest_plus')}
      ${cardProduct('lcs_workbook')}
      ${cardProduct('first_flight')}
      ${cardProduct('coaching')}
      ${cardProduct('solo_course')}
      ${cardProduct('life_change_intensive')}
    </div>`;
    productsPane.querySelectorAll('[data-open-ask]').forEach((btn) => {
      btn.addEventListener('click', () => setTab('ask'));
    });
    productsPane.querySelectorAll('[data-open-canvas]').forEach((btn) => {
      btn.addEventListener('click', () => setTab('canvas'));
    });
    productsPane.querySelectorAll('[data-upgrade]').forEach((btn) => {
      btn.addEventListener('click', () => void startUpgrade(btn.dataset.upgrade, btn));
    });
    productsPane.querySelectorAll('[data-manage-plus]').forEach((btn) => {
      btn.addEventListener('click', () => void openNestPlusBilling(btn));
    });
    productsPane.querySelectorAll('[data-go-photo]').forEach((btn) => {
      btn.addEventListener('click', goToPhoto);
    });
    renderSidebarRelationship();
    renderNavPlan();
    const claimBtn = productsPane.querySelector('#btn-lci-claim');
    if (claimBtn) {
      claimBtn.addEventListener('click', () => void claimNextLciSession(claimBtn));
    }
    const linkIcBtn = productsPane.querySelector('#btn-link-inner-compass');
    if (linkIcBtn) {
      linkIcBtn.addEventListener('click', () => void linkInnerCompassToAccount(linkIcBtn));
    }
  }

  function youngerYouPhotoUrl() {
    return courseProfile?.childhood_photo_url || '';
  }

  function childhoodPhotoExt(file) {
    const fromName = (file.name || '').split('.').pop()?.toLowerCase();
    if (fromName && fromName.length <= 5) return fromName;
    const fromType = (file.type || '').split('/')[1];
    return (fromType || 'jpg').toLowerCase();
  }

  async function ensureCourseUserRow() {
    if (!currentUser?.id) throw new Error('Not signed in.');
    const email = currentUser.email || '';
    const fullName =
      courseProfile?.full_name ||
      currentUser.user_metadata?.full_name ||
      '';
    const { error } = await sb.from('course_users').upsert(
      {
        id: currentUser.id,
        email,
        full_name: fullName || null
      },
      { onConflict: 'id' }
    );
    if (error) throw error;
    if (!courseProfile) {
      courseProfile = { id: currentUser.id, email, full_name: fullName || null };
    }
  }

  async function saveYoungerYouPhoto(file) {
    if (!currentUser?.id) throw new Error('Not signed in.');
    if (!file || !file.type?.startsWith('image/')) {
      throw new Error("That doesn't look like an image file.");
    }
    if (file.size > CHILDHOOD_PHOTO_MAX_BYTES) {
      throw new Error('That file is over 10 MB. Try a smaller version.');
    }

    await ensureCourseUserRow();

    const ext = childhoodPhotoExt(file);
    const path = currentUser.id + '/photo-' + Date.now() + '.' + ext;
    const { error: upErr } = await sb.storage.from(CHILDHOOD_PHOTO_BUCKET).upload(path, file, {
      cacheControl: '3600',
      contentType: file.type || 'image/jpeg',
      upsert: false
    });
    if (upErr) throw upErr;

    const { data: pub } = sb.storage.from(CHILDHOOD_PHOTO_BUCKET).getPublicUrl(path);
    const photoUrl = pub?.publicUrl;
    if (!photoUrl) throw new Error('Could not generate a public URL for the photo.');

    const { error: dbErr } = await sb
      .from('course_users')
      .update({ childhood_photo_url: photoUrl })
      .eq('id', currentUser.id);
    if (dbErr) throw dbErr;

    try {
      await sb.from('tool_outputs').upsert(
        {
          user_id: currentUser.id,
          tool_name: 'childhood_photo',
          output_data: { photo_url: photoUrl, uploaded_at: new Date().toISOString() },
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id,tool_name' }
      );
    } catch (e) {
      console.warn('tool_outputs childhood_photo mirror:', e);
    }

    if (hasSoloCourseAccess()) {
      try {
        await fetch(SOLO_WORKER_URL + '/notify-illustrator', {
          method: 'POST',
          headers: await workerAuthHeaders(),
          body: JSON.stringify({ photo_url: photoUrl })
        });
      } catch (e) {
        console.warn('notify-illustrator:', e);
      }
    }

    courseProfile = { ...(courseProfile || {}), childhood_photo_url: photoUrl };
    return photoUrl;
  }

  async function removeYoungerYouPhoto() {
    if (!currentUser?.id) throw new Error('Not signed in.');
    const oldUrl = youngerYouPhotoUrl();
    const { error: dbErr } = await sb
      .from('course_users')
      .update({ childhood_photo_url: null })
      .eq('id', currentUser.id);
    if (dbErr) throw dbErr;

    try {
      await sb.from('tool_outputs').delete().eq('user_id', currentUser.id).eq('tool_name', 'childhood_photo');
    } catch (e) {
      console.warn('tool_outputs childhood_photo remove:', e);
    }

    const marker = '/' + CHILDHOOD_PHOTO_BUCKET + '/';
    const at = oldUrl.indexOf(marker);
    if (at !== -1) {
      const path = decodeURIComponent(oldUrl.slice(at + marker.length).split('?')[0]);
      if (path.startsWith(currentUser.id + '/')) {
        try {
          await sb.storage.from(CHILDHOOD_PHOTO_BUCKET).remove([path]);
        } catch (e) {
          console.warn('childhood photo file remove:', e);
        }
      }
    }

    courseProfile = { ...(courseProfile || {}), childhood_photo_url: null };
  }

  function updateNavAvatar() {
    const btn = document.getElementById('btn-nav-profile');
    if (!btn) return;
    const url = youngerYouPhotoUrl();
    if (url) {
      btn.classList.add('has-photo');
      btn.classList.remove('needs-photo');
      btn.title = 'Change your Nest picture';
      btn.setAttribute('aria-label', 'Change your Nest picture');
      btn.innerHTML =
        '<img src="' + escapeHtml(url) + '" alt="" width="30" height="30" />' +
        '<span class="avatar-edit" aria-hidden="true"><i class="ti ti-camera"></i></span>';
    } else {
      btn.classList.remove('has-photo');
      btn.classList.add('needs-photo');
      btn.title = 'Add your Nest picture';
      btn.setAttribute('aria-label', 'Add your Nest picture');
      btn.innerHTML = '<i class="ti ti-camera-plus"></i>';
    }
  }

  function goToPhoto() {
    setTab('profile');
    requestAnimationFrame(() => {
      const card = document.querySelector('.younger-you-card');
      if (!card) return;
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.remove('is-pulsing');
      void card.offsetWidth;
      card.classList.add('is-pulsing');
    });
  }

  function renderPhotoPrompt() {
    if (youngerYouPhotoUrl()) return '';
    return `
      <article class="product-card photo-prompt-card">
        <span class="photo-prompt-icon" aria-hidden="true"><i class="ti ti-camera-plus"></i></span>
        <div>
          <h3>Add a picture of little you</h3>
          <p>A photo of you around ages 4–8 makes your Nest feel like yours, and it’s a lovely reminder of who you were before the world told you who to be.</p>
          <div class="btn-row"><button type="button" class="btn btn-outline" data-go-photo>Add my picture →</button></div>
        </div>
      </article>`;
  }

  function premiumMailto() {
    const email = currentUser?.email || '';
    const body = encodeURIComponent(email ? 'Please tell me when Nest Premium opens.\n\nMy Nest email: ' + email : 'Please tell me when Nest Premium opens.');
    return 'mailto:hello@lilbird.life?subject=' + encodeURIComponent('Tell me when Nest Premium opens') + '&body=' + body;
  }

  function liveClocks(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const pt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
    const mel = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(date);
    return pt + ' Pacific · ' + mel + ' Melbourne';
  }

  async function workerPost(path, payload) {
    const res = await fetch(SOLO_WORKER_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(payload || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
    return data;
  }

  function renderLiveGroup() {
    const el = document.getElementById('sidebar-live-card');
    if (!el) return;
    el.innerHTML = `
      <p class="sidebar-eyebrow">Live group coaching</p>
      <h4>Live group coaching</h4>
      <p>Checking the door…</p>`;
    void loadLiveCard();
  }

  async function loadLiveCard() {
    const el = document.getElementById('sidebar-live-card');
    if (!el) return;
    let data = null;
    try {
      data = await workerPost('/live-status', {});
    } catch (e) {
      data = null;
    }
    const session = data?.session;
    const clocks = session ? liveClocks(session.startsAt) : '';
    if (data?.removed) {
      el.innerHTML = `
        <p class="sidebar-eyebrow">Live group coaching</p>
        <h4>This live is closed for you</h4>
        <p>You were taken out of this session. Email hello@lilbird.life if that needs a look.</p>`;
      return;
    }
    if (session && data.entitled && session.status === 'live') {
      el.innerHTML = `
        <p class="sidebar-eyebrow">Live group coaching</p>
        <h4>The door is open</h4>
        <p>${escapeHtml(clocks)}. The room holds ${escapeHtml(String(session.capacity || 15))}.</p>
        <button type="button" class="btn btn-gold full" id="btn-live-join">Join the live</button>
        <p id="live-join-status" class="younger-you-status" role="status"></p>`;
      el.querySelector('#btn-live-join')?.addEventListener('click', () => void joinLive());
      return;
    }
    if (session && data.entitled) {
      el.innerHTML = `
        <p class="sidebar-eyebrow">Live group coaching</p>
        <h4>You're on the list for this live</h4>
        <p>${escapeHtml(clocks)}. Join appears here when the room opens. Your access is checked at that moment.</p>`;
      return;
    }
    el.innerHTML = `
      <p class="sidebar-eyebrow">Live group coaching <span class="soon-tag">Coming soon</span></p>
      <h4>Live group coaching</h4>
      <p>${session ? escapeHtml(clocks) + '. ' : ''}A session with Luke and other people in the Nest. $47 a month when booking opens. Intensive clients are included for the first year.</p>
      <button type="button" class="btn btn-outline full" id="btn-premium-waitlist">Tell me when it opens</button>
      <p id="waitlist-status" class="younger-you-status" role="status"></p>`;
    el.querySelector('#btn-premium-waitlist')?.addEventListener('click', () => void joinWaitlist());
  }

  async function joinLive() {
    const status = document.getElementById('live-join-status');
    if (status) status.textContent = 'Opening the door…';
    try {
      const data = await workerPost('/live-join', {});
      if (data.url) window.open(data.url, '_blank', 'noopener');
      if (status) status.textContent = 'The room is open in a new tab.';
    } catch (e) {
      if (status) status.textContent = e.message;
    }
  }

  async function joinWaitlist() {
    const status = document.getElementById('waitlist-status');
    try {
      await workerPost('/premium-waitlist', {});
      if (status) status.textContent = 'Saved. You will hear when the live opens.';
    } catch (e) {
      if (status) status.textContent = e.message;
    }
  }

  function renderSidebarRelationship() {
    const el = document.getElementById('sidebar-relationship-card');
    if (!el) return;
    if (hasNestPlus()) {
      const link = deepNestId
        ? '/relationship-dynamic.html?nest=' + encodeURIComponent(deepNestId) + '&from=nest'
        : '/relationship-dynamic.html?from=nest';
      el.innerHTML = `
        <p class="sidebar-eyebrow">relationship dynamic · nest plus</p>
        <h4>How do you fit with someone close?</h4>
        <p>Use your wiring to understand a partner, friend, family member or colleague.</p>
        <a class="btn btn-outline full" href="${escapeHtml(link)}">Open tool →</a>`;
      return;
    }
    el.innerHTML = '';
  }

  function renderNavPlan() {
    const el = document.getElementById('nav-plan');
    if (!el) return;
    const plan = planInfo();
    const plus = plan.name !== 'Nest';
    el.textContent = plus ? '✦ ' + plan.name : 'Nest';
    el.classList.toggle('is-plus', plus);
    el.title = plan.note;
    el.classList.remove('hidden');
  }

  function setYoungerYouStatus(msg, kind) {
    const el = document.getElementById('younger-you-status');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'younger-you-status' + (msg ? ' visible' : '') + (kind ? ' ' + kind : '');
  }

  function bindYoungerYouUpload() {
    const input = document.getElementById('younger-you-file');
    const saveBtn = document.getElementById('btn-younger-you-save');
    const clearBtn = document.getElementById('btn-younger-you-clear');
    const preview = document.getElementById('younger-you-preview');
    const removeBtn = document.getElementById('btn-younger-you-remove');
    if (!input) return;

    if (removeBtn) {
      removeBtn.addEventListener('click', async () => {
        if (!confirm('Remove your Nest picture?')) return;
        removeBtn.disabled = true;
        setYoungerYouStatus('Removing…', '');
        try {
          await removeYoungerYouPhoto();
          updateNavAvatar();
          renderNextSteps();
          renderProducts();
          renderProfile();
        } catch (err) {
          console.error('Nest photo remove:', err);
          setYoungerYouStatus(err.message || 'Something went wrong. Try again.', 'error');
          removeBtn.disabled = false;
        }
      });
    }

    let pendingFile = null;

    function showPending(file) {
      pendingFile = file;
      if (preview) {
        const url = URL.createObjectURL(file);
        preview.innerHTML =
          '<img class="younger-you-photo" src="' +
          url +
          '" alt="Preview" width="88" height="88" />';
      }
      if (saveBtn) {
        saveBtn.classList.remove('hidden');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Nest picture →';
      }
      if (clearBtn) clearBtn.classList.remove('hidden');
      if (removeBtn) removeBtn.classList.add('hidden');
      setYoungerYouStatus('Looks good. Save to use this as your Nest picture.', '');
    }

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        setYoungerYouStatus("That doesn't look like an image file.", 'error');
        return;
      }
      if (file.size > CHILDHOOD_PHOTO_MAX_BYTES) {
        setYoungerYouStatus('That file is over 10 MB. Try a smaller version.', 'error');
        return;
      }
      showPending(file);
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        pendingFile = null;
        input.value = '';
        if (saveBtn) saveBtn.classList.add('hidden');
        clearBtn.classList.add('hidden');
        setYoungerYouStatus('');
        renderProfile();
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        if (!pendingFile) return;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';
        setYoungerYouStatus('Uploading your photo…', '');
        try {
          await saveYoungerYouPhoto(pendingFile);
          updateNavAvatar();
          renderNextSteps();
          renderProducts();
          renderProfile();
          setYoungerYouStatus('Saved. This is your Nest picture.', 'success');
        } catch (err) {
          console.error('Nest photo upload:', err);
          setYoungerYouStatus(err.message || 'Something went wrong. Try again.', 'error');
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Nest picture →';
        }
      });
    }
  }

  function renderYoungerYouCard() {
    const url = youngerYouPhotoUrl();
    if (url) {
      return `
        <article class="product-card younger-you-card">
          <p class="eyebrow">nest picture</p>
          <div class="younger-you-row">
            <label class="younger-you-photo-edit" for="younger-you-file" title="Change photo">
              <img class="younger-you-photo" src="${escapeHtml(url)}" alt="Younger you" width="88" height="88" />
              <span class="younger-you-photo-badge" aria-hidden="true"><i class="ti ti-camera"></i></span>
            </label>
            <div>
              <h3>Your Nest picture</h3>
              <p>You around ages 4–8. Shows on your Nest${hasSoloCourseAccess() ? ' and Full Flight Plan' : ''}.</p>
              <div class="btn-row younger-you-actions">
                <label class="btn btn-outline younger-you-file-label" for="younger-you-file"><i class="ti ti-camera"></i>&nbsp;Change photo</label>
                <input id="younger-you-file" class="younger-you-file-input" type="file" accept="image/*" />
                <button type="button" class="btn btn-gold hidden" id="btn-younger-you-save">Save Nest picture →</button>
                <button type="button" class="btn btn-outline hidden" id="btn-younger-you-clear">Cancel</button>
                <button type="button" class="younger-you-remove" id="btn-younger-you-remove">Remove</button>
              </div>
              <div id="younger-you-preview" class="younger-you-preview"></div>
              <p id="younger-you-status" class="younger-you-status" role="status"></p>
            </div>
          </div>
        </article>`;
    }
    return `
      <article class="product-card younger-you-card">
        <p class="eyebrow">nest picture</p>
        <h3>Add a picture of little you</h3>
        <p>Dig out a photo of you around ages 4–8. It becomes your Nest picture${hasSoloCourseAccess() ? ' and sits on your Full Flight Plan' : ''}, a small daily reminder of who you were before anyone told you who to be.</p>
        <div class="btn-row younger-you-actions">
          <label class="btn btn-gold younger-you-file-label" for="younger-you-file">Choose a photo</label>
          <input id="younger-you-file" class="younger-you-file-input" type="file" accept="image/*" />
          <button type="button" class="btn btn-gold hidden" id="btn-younger-you-save">Save Nest picture →</button>
          <button type="button" class="btn btn-outline hidden" id="btn-younger-you-clear">Cancel</button>
        </div>
        <div id="younger-you-preview" class="younger-you-preview"></div>
        <p id="younger-you-status" class="younger-you-status" role="status"></p>
        <p class="younger-you-hint">JPG · PNG · HEIC · up to 10 MB. Outdoor light, eyes visible if you can.</p>
      </article>`;
  }

  function renderProfile() {
    const pane = document.getElementById('pane-profile');
    const youngerCard = renderYoungerYouCard();
    if (hasInnerCompassComplete()) {
      pane.innerHTML = `
        <div class="product-grid">
          ${youngerCard}
          <article class="product-card ic-snapshot-card ic-snapshot-card--profile">
            ${renderInnerCompassSnapshotMarkup('profile')}
          </article>
        </div>`;
    } else if (hasInnerCompassAccess()) {
      pane.innerHTML = `
        <div class="product-grid">
          ${youngerCard}
          <article class="product-card">
            <p class="eyebrow">inner compass</p>
            <h3>Inner Compass profile</h3>
            <span class="status-badge pending">connect your read</span>
            <p>Paste your results link from email on the Inner Compass card (Products tab), or open your read below.</p>
            <div class="btn-row">
              <button type="button" class="btn btn-outline" id="btn-link-inner-compass-profile">Connect my results</button>
              <a class="btn btn-gold" href="${innerCompassHref()}">Take / open Inner Compass →</a>
            </div>
          </article>
        </div>`;
      const profileLinkBtn = pane.querySelector('#btn-link-inner-compass-profile');
      if (profileLinkBtn) {
        profileLinkBtn.addEventListener('click', () => void linkInnerCompassToAccount(profileLinkBtn));
      }
    } else {
      pane.innerHTML = `
        <div class="product-grid">
          ${youngerCard}
          <article class="product-card locked">
            <span class="lock-pill"><i class="ti ti-lock"></i> not yet unlocked</span>
            <p class="eyebrow">inner compass</p>
            <h3>Inner Compass profile</h3>
            <p>Take your Inner Compass read first. Your profile will appear here once unlocked.</p>
            <div class="btn-row"><a class="btn btn-ember" href="/inner-compass/?from=nest">Take the Inner Compass →</a></div>
          </article>
        </div>`;
    }
    bindYoungerYouUpload();
    attachAccountTools();
  }

  function accountToolsHtml() {
    return `
      <article class="product-card account-card">
        <p class="eyebrow">your account</p>
        <h3>One email for this Nest</h3>
        <p>If you also have a Nest on another email, bring it here. We email that inbox first. Nothing moves until you confirm the picture of both accounts.</p>
        <div id="account-reads"></div>
        <div id="account-pending"></div>
        <label>Other Nest email
          <input id="merge-email" type="email" autocomplete="email" placeholder="the other inbox" />
        </label>
        <div class="btn-row">
          <button type="button" class="btn btn-gold" id="btn-merge-start">Email that inbox</button>
          <button type="button" class="btn btn-outline hidden" id="btn-merge-check">Check the other inbox</button>
        </div>
        <div id="account-preview" class="account-preview"></div>
        <p id="account-status" class="younger-you-status" role="status"></p>
        <div class="btn-row">
          <button type="button" class="btn btn-outline" id="btn-account-export">Download my Nest</button>
          <button type="button" class="btn btn-outline hidden" id="btn-merge-undo">Undo the merge</button>
        </div>
        <label>Tell the desk
          <textarea id="trouble-note" rows="2" placeholder="What happened, and which part of the Nest"></textarea>
        </label>
        <button type="button" class="btn btn-outline" id="btn-trouble">Send to the desk</button>
        <label>Close my Nest
          <input id="close-confirm" type="text" autocomplete="off" placeholder="close my nest" />
        </label>
        <button type="button" class="btn btn-outline" id="btn-account-close">Close my Nest</button>
      </article>`;
  }

  function attachAccountTools() {
    const pane = document.getElementById('pane-profile');
    if (!pane || pane.querySelector('.account-card')) return;
    pane.insertAdjacentHTML('beforeend', accountToolsHtml());
    pane.querySelector('#btn-merge-start')?.addEventListener('click', () => void startMerge());
    pane.querySelector('#btn-merge-check')?.addEventListener('click', () => void refreshAccountTools(true));
    pane.querySelector('#btn-account-export')?.addEventListener('click', () => void exportNest());
    pane.querySelector('#btn-merge-undo')?.addEventListener('click', () => void undoMerge());
    pane.querySelector('#btn-trouble')?.addEventListener('click', () => void sendTrouble());
    pane.querySelector('#btn-account-close')?.addEventListener('click', () => void closeNest());
    void refreshAccountTools(false);
  }

  function accountStatus(text) {
    const el = document.getElementById('account-status');
    if (el) el.textContent = text || '';
  }

  async function refreshAccountTools(previewIfReady) {
    let data;
    try {
      data = await workerPost('/merge-status', {});
    } catch (e) {
      accountStatus(e.message);
      return;
    }
    const reads = document.getElementById('account-reads');
    if (reads) {
      const list = data.reads || [];
      reads.innerHTML = list.length
        ? '<p>Compass reads on this email</p><ul>' + list.map((read) =>
          `<li>${escapeHtml(read.nestId)}${read.overall != null ? ' · overall ' + read.overall : ''}${read.primary ? ' · opens first' : ''} ${read.primary ? '' : `<button type="button" class="btn btn-outline" data-primary-nest="${escapeHtml(read.nestId)}">Open this one first</button>`}</li>`
        ).join('') + '</ul>'
        : '';
      reads.querySelectorAll('[data-primary-nest]').forEach((btn) => {
        btn.addEventListener('click', () => void makePrimary(btn.dataset.primaryNest));
      });
    }
    const pending = document.getElementById('account-pending');
    const check = document.getElementById('btn-merge-check');
    if (pending) {
      pending.textContent = data.pending
        ? (data.pending.verified
          ? 'The other inbox is confirmed. Check it, then choose which Compass opens first.'
          : 'Waiting for ' + data.pending.otherEmail + ' to open the email.')
        : '';
    }
    if (check) check.classList.toggle('hidden', !data.pending);
    const undo = document.getElementById('btn-merge-undo');
    if (undo) undo.classList.toggle('hidden', !data.recentMerge);
    if (previewIfReady && data.pending?.verified) await showMergePreview();
    const desk = document.getElementById('nav-desk');
    if (desk) {
      try {
        await workerPost('/desk', { action: 'me' });
        desk.classList.remove('hidden');
      } catch (e) {
        desk.classList.add('hidden');
      }
    }
  }

  async function startMerge() {
    const email = document.getElementById('merge-email')?.value || '';
    accountStatus('Sending the confirmation…');
    try {
      const data = await workerPost('/merge-start', { otherEmail: email });
      accountStatus('Sent to ' + (data.otherEmail || 'that inbox') + '. Open it there, then come back and check.');
      await refreshAccountTools(false);
    } catch (e) {
      accountStatus(e.message);
    }
  }

  function previewList(title, account) {
    const products = (account.products || []).join(', ') || 'No purchases';
    const reads = (account.reads || []).map((read) => read.nestId + (read.overall != null ? ' (' + read.overall + ')' : '')).join(', ') || 'No Compass';
    const subs = (account.subscriptions || []).map((sub) => sub.status).join(', ');
    return `<div><strong>${escapeHtml(title)}</strong><ul><li>${escapeHtml(account.email || '')}</li><li>${escapeHtml(products)}</li><li>${escapeHtml(reads)}</li>${subs ? `<li>Nest Plus: ${escapeHtml(subs)}</li>` : ''}</ul></div>`;
  }

  async function showMergePreview() {
    const box = document.getElementById('account-preview');
    if (!box) return;
    try {
      const data = await workerPost('/merge-preview', {});
      const nests = [...(data.keeper?.reads || []), ...(data.other?.reads || [])];
      const choices = nests.map((read) =>
        `<label class="account-choice"><input type="radio" name="primary-nest" value="${escapeHtml(read.nestId)}" ${read.primary ? 'checked' : ''}/> ${escapeHtml(read.nestId)}${read.overall != null ? ' · ' + read.overall : ''}</label>`
      ).join('');
      box.innerHTML = previewList('This email', data.keeper) + previewList('The other email', data.other) +
        (data.doublePlus ? '<p>Both emails are paying for Nest Plus. The merge will not cancel either charge. We will see both on the desk so one can be cancelled in Stripe.</p>' : '') +
        (choices ? '<p>Which Compass opens first</p>' + choices : '') +
        '<button type="button" class="btn btn-gold" id="btn-merge-confirm">Bring it onto this email</button>';
      box.querySelector('#btn-merge-confirm')?.addEventListener('click', () => void confirmMerge());
    } catch (e) {
      accountStatus(e.message);
    }
  }

  async function confirmMerge() {
    const chosen = document.querySelector('input[name="primary-nest"]:checked')?.value || '';
    accountStatus('Bringing the other Nest across…');
    try {
      const data = await workerPost('/merge-confirm', { primaryNestId: chosen });
      accountStatus(data.doublePlus
        ? 'Done. Both Nest Plus charges are still active. We can see that on the desk.'
        : 'Done. The other login is closed. You can undo this for a week.');
      document.getElementById('account-preview').innerHTML = '';
      await refreshAccountTools(false);
    } catch (e) {
      accountStatus(e.message);
    }
  }

  async function makePrimary(nestId) {
    try {
      await workerPost('/nest-primary', { nestId });
      accountStatus('That Compass opens first now. Refresh if the read looks unchanged.');
      await refreshAccountTools(false);
    } catch (e) {
      accountStatus(e.message);
    }
  }

  async function undoMerge() {
    accountStatus('Undoing the merge…');
    try {
      await workerPost('/merge-undo', {});
      accountStatus('Undone. The other login works again.');
      await refreshAccountTools(false);
    } catch (e) {
      accountStatus(e.message);
    }
  }

  async function exportNest() {
    accountStatus('Preparing your download…');
    try {
      const data = await workerPost('/account-export', {});
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lilbird-nest.json';
      a.click();
      URL.revokeObjectURL(url);
      accountStatus('Downloaded.');
    } catch (e) {
      accountStatus(e.message);
    }
  }

  async function sendTrouble() {
    const message = document.getElementById('trouble-note')?.value || '';
    try {
      await workerPost('/nest-trouble', { message });
      accountStatus('Sent to the desk.');
      const note = document.getElementById('trouble-note');
      if (note) note.value = '';
    } catch (e) {
      accountStatus(e.message);
    }
  }

  async function closeNest() {
    const confirmText = document.getElementById('close-confirm')?.value || '';
    try {
      const data = await workerPost('/account-close', { confirm: confirmText });
      if (data.billing) {
        accountStatus(data.message);
        return;
      }
      accountStatus('This Nest is closed. You can log out.');
    } catch (e) {
      accountStatus(e.message);
    }
  }

  function renderSidebar() {
    renderLiveGroup();
    const el = document.getElementById('sidebar-context-card');
    const hasIntensive = entitlements.has('life_change_intensive');
    const email = encodeURIComponent(currentUser?.email || '');
    const name = encodeURIComponent(courseProfile?.full_name || currentUser?.user_metadata?.full_name || '');
    const coachingHref = `/coaching/book.html?from=nest${email ? `&email=${email}` : ''}${name ? `&name=${name}` : ''}`;

    if (hasIntensive) {
      const stats = lciStats();
      if (stats.hasRows && stats.remaining > 0) {
        el.innerHTML = `
          <p class="sidebar-eyebrow">intensive</p>
          <h4>Book your next session</h4>
          <p>${stats.remaining} of ${stats.total} sessions remaining. Book one at a time from your Intensive card.</p>
          <a class="btn btn-ember full" href="${escapeHtml(LCI_BOOKING_URL)}" target="_blank" rel="noopener">Book next session →</a>
          <a class="btn btn-outline full" href="${workbookHref('life-change')}">Open workbook</a>`;
        return;
      }
      if (stats.hasRows && stats.allBooked) {
        el.innerHTML = `
          <p class="sidebar-eyebrow">intensive</p>
          <h4>All sessions booked</h4>
          <p>Reach out to Luke if you need anything between sessions.</p>
          <a class="btn btn-outline full" href="mailto:hello@lilbird.life">Email Luke</a>`;
        return;
      }
      el.innerHTML = `
        <p class="sidebar-eyebrow">intensive</p>
        <h4>Your Intensive is active</h4>
        <p>Use the Intensive card on My products to book sessions and open your workbook.</p>
        <button type="button" class="btn btn-outline full" id="btn-sidebar-products">Open My products</button>`;
      el.querySelector('#btn-sidebar-products')?.addEventListener('click', () => setTab('products'));
      return;
    }

    if (entitlements.has('first_flight')) {
      el.innerHTML = `
        <p class="sidebar-eyebrow">session context</p>
        <h4>First Flight booked</h4>
        <p>Confirm from your booking email and complete your workbook first.</p>
        <a class="btn btn-outline full" href="${workbookHref('first-flight')}">Open workbook</a>
        <a class="btn btn-outline full" href="mailto:hello@lilbird.life?subject=My%20First%20Flight">Email Luke</a>`;
      return;
    }

    if (hasSoloCourseAccess()) {
      const p = progressSummary();
      if (p.pct >= 100) {
        el.innerHTML = `
        <p class="sidebar-eyebrow">session context</p>
        <h4>Solo complete</h4>
        <p>Your plan and takeaways live on the Solo dashboard. Book a session with Luke anytime below.</p>
        <a class="btn btn-outline full" href="/solo/?view=plan">Open your plan →</a>
        <a class="btn btn-ember full" href="/first-flight/book.html?code=IMREADY">Book First Flight · $149</a>
        <a class="btn btn-outline full" href="${coachingHref}">Book coaching · $249</a>`;
        return;
      }
      el.innerHTML = `
        <p class="sidebar-eyebrow">session context</p>
        <h4>Solo next step</h4>
        <p>Next up: ${escapeHtml(p.next)}. Prefer a live session? Book from your Nest.</p>
        <a class="btn btn-outline full" href="/solo/">Continue Solo →</a>
        <a class="btn btn-ember full" href="/first-flight/book.html?code=IMREADY">Book First Flight · $149</a>
        <a class="btn btn-outline full" href="${coachingHref}">Book coaching · $249</a>`;
      return;
    }

    if (!hasNestPlus()) {
      el.classList.remove('ember');
      el.innerHTML = `
        <p class="sidebar-eyebrow">Nest Plus · $7.99/month</p>
        <h4>The Intensive workbook, on your own time</h4>
        <p>Life Canvas, the full Inner Compass read, Relationship Dynamic, and Roots &amp; Wings. Eight sessions, the same workbook as the Intensive. Cancel anytime.</p>
        <button type="button" class="btn btn-ember full" id="btn-sidebar-plus">Add Nest Plus · $7.99/month →</button>`;
      el.querySelector('#btn-sidebar-plus')?.addEventListener('click', (e) => void startUpgrade('nest_plus', e.currentTarget));
      return;
    }

    el.classList.add('ember');
    el.innerHTML = `
      <p class="sidebar-eyebrow">one to one</p>
      <h4>When you want Luke, just you</h4>
      <p>First Flight is one session. Coaching is there when something specific needs the hour. The Intensive is the full eight.</p>
      <a class="btn btn-outline full" href="/first-flight/book.html?code=IMREADY">First Flight · $149 →</a>
      <a class="btn btn-outline full" href="${coachingHref}">Coaching · $249 →</a>
      <a class="btn btn-outline full" href="/intensive/enrol.html?from=nest">Life Change Intensive →</a>`;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function canvasScoreSet(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const scores = {};
    for (const dim of CANVAS_DIMS) {
      const n = Number(raw[dim.key]);
      if (!Number.isFinite(n)) return null;
      scores[dim.key] = Math.max(0, Math.min(100, Math.round(n)));
    }
    return scores;
  }

  function canvasOverall(scores) {
    return Math.round(CANVAS_DIMS.reduce((sum, dim) => sum + scores[dim.key], 0) / CANVAS_DIMS.length);
  }

  function canvasChrono(history) {
    const time = (iso) => {
      const t = new Date(iso).getTime();
      return Number.isNaN(t) ? 0 : t;
    };
    return (history || []).slice().sort((a, b) => time(a.date) - time(b.date));
  }

  function canvasDelta(chrono, key) {
    if (!chrono || chrono.length < 2) return 0;
    const first = key === 'overall' ? chrono[0].overall : chrono[0].scores[key];
    const last = key === 'overall' ? chrono[chrono.length - 1].overall : chrono[chrono.length - 1].scores[key];
    return last - first;
  }

  function canvasDeltaColor(d) {
    if (d > 0) return '#4adea8';
    if (d < 0) return '#e8734a';
    return 'currentColor';
  }

  function canvasDeltaText(d) {
    return (d > 0 ? '+' : '') + d;
  }

  function canvasDateLabel(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function applyCanvasPayload(payload) {
    const scores = canvasScoreSet(payload && payload.canvasScores);
    canvasScores = scores;
    const history = Array.isArray(payload && payload.canvasHistory) ? payload.canvasHistory : [];
    canvasHistory = history
      .map((entry) => {
        const set = canvasScoreSet(entry && entry.scores);
        if (!set || !entry.date) return null;
        return { scores: set, overall: canvasOverall(set), date: entry.date };
      })
      .filter(Boolean)
      .slice(0, 24);
    const profile = payload && payload.profile && typeof payload.profile === 'object' ? payload.profile : {};
    canvasSynthesis = typeof profile.canvasSynthesis === 'string' ? profile.canvasSynthesis.trim() : '';
    canvasTexts = profile.canvasTexts && typeof profile.canvasTexts === 'object' ? profile.canvasTexts : null;
    if (scores && !canvasHistory.length && deepNestId) {
      const entry = {
        scores,
        overall: canvasOverall(scores),
        date: (payload && payload.createdAt) || 'canvas-baseline'
      };
      canvasHistory = [entry];
      fetch(ASSESSMENT_WORKER_URL + '/store-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nestId: deepNestId, canvasScores: scores, canvasHistory: [entry] })
      }).catch(() => {});
    }
  }

  function canvasTrendSvg(data, color, height, fill) {
    const width = 360;
    const padL = 6;
    const padR = 6;
    const padT = 10;
    const padB = 8;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;
    const pts = data.map((v, i) => {
      const x = padL + (i / Math.max(data.length - 1, 1)) * innerW;
      const y = padT + (1 - v / 100) * innerH;
      return { x, y };
    });
    const line = pts.map((p) => p.x + ',' + p.y).join(' ');
    const area = fill && pts.length
      ? '<polygon points="' + line + ' ' + pts[pts.length - 1].x + ',' + (padT + innerH) + ' ' + pts[0].x + ',' + (padT + innerH) + '" fill="' + color + '" fill-opacity="0.14"/>'
      : '';
    const dot = pts.length
      ? '<circle cx="' + pts[pts.length - 1].x + '" cy="' + pts[pts.length - 1].y + '" r="3.5" fill="' + color + '"/>'
      : '';
    return '<svg class="lc-chart" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none" aria-hidden="true">' +
      area +
      '<polyline fill="none" stroke="' + color + '" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" points="' + line + '"/>' +
      dot +
      '</svg>';
  }

  function canvasRadarSvg(scores, compare) {
    const size = 220;
    const cx = size / 2;
    const cy = size / 2;
    const maxR = 78;
    const pointSet = (set) => CANVAS_DIMS.map((dim, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / CANVAS_DIMS.length;
      const r = (set[dim.key] / 100) * maxR;
      return (cx + r * Math.cos(angle)) + ',' + (cy + r * Math.sin(angle));
    }).join(' ');
    let svg = '<svg class="lc-radar" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="Life Canvas shape">';
    [0.33, 0.66, 1].forEach((t) => {
      svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (maxR * t) + '" fill="none" stroke="currentColor" stroke-opacity="0.2"/>';
    });
    CANVAS_DIMS.forEach((dim, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / CANVAS_DIMS.length;
      svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + maxR * Math.cos(angle)) + '" y2="' + (cy + maxR * Math.sin(angle)) + '" stroke="currentColor" stroke-opacity="0.16"/>';
    });
    if (compare) {
      svg += '<polygon points="' + pointSet(compare) + '" fill="rgba(160,152,128,0.12)" stroke="rgba(160,152,128,0.7)" stroke-width="1.4"/>';
    }
    svg += '<polygon points="' + pointSet(scores) + '" fill="rgba(245,200,66,0.2)" stroke="#F5C842" stroke-width="1.6"/>';
    CANVAS_DIMS.forEach((dim, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / CANVAS_DIMS.length;
      const r = (scores[dim.key] / 100) * maxR;
      svg += '<circle cx="' + (cx + r * Math.cos(angle)) + '" cy="' + (cy + r * Math.sin(angle)) + '" r="3.4" fill="' + dim.color + '"/>';
    });
    return svg + '</svg>';
  }

  function canvasPatternsSvg(chrono) {
    const width = 360;
    const height = 210;
    const padL = 28;
    const padR = 12;
    const padT = 14;
    const padB = 28;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;
    const series = [{ name: 'Overall', key: 'overall', color: '#F5C842', width: 2.5 }].concat(
      CANVAS_DIMS.map((dim) => ({ name: dim.title, key: dim.key, color: dim.color, width: 1.7 }))
    );
    let svg = '<svg class="lc-chart" viewBox="0 0 ' + width + ' ' + height + '" aria-hidden="true">';
    [0.25, 0.5, 0.75].forEach((t) => {
      const y = padT + innerH * t;
      svg += '<line x1="' + padL + '" x2="' + (width - padR) + '" y1="' + y + '" y2="' + y + '" stroke="currentColor" stroke-opacity="0.2" stroke-dasharray="3 6"/>';
    });
    series.forEach((item) => {
      if (canvasHiddenSeries[item.key]) return;
      const pts = chrono.map((entry, i) => {
        const value = item.key === 'overall' ? entry.overall : entry.scores[item.key];
        const x = padL + (i / Math.max(chrono.length - 1, 1)) * innerW;
        const y = padT + (1 - value / 100) * innerH;
        return x + ',' + y;
      }).join(' ');
      svg += '<polyline fill="none" stroke="' + item.color + '" stroke-width="' + item.width + '" stroke-linecap="round" stroke-linejoin="round" points="' + pts + '"/>';
    });
    svg += '<text x="' + padL + '" y="' + (height - 8) + '" fill="currentColor" font-size="10">' + escapeHtml(canvasDateLabel(chrono[0].date)) + '</text>';
    svg += '<text x="' + (width - padR) + '" y="' + (height - 8) + '" fill="currentColor" font-size="10" text-anchor="end">' + escapeHtml(canvasDateLabel(chrono[chrono.length - 1].date)) + '</text></svg>';
    const legend = series.map((item) => {
      const hidden = !!canvasHiddenSeries[item.key];
      const delta = canvasDelta(chrono, item.key);
      return '<button type="button" class="lc-legend-btn' + (hidden ? ' is-hidden' : '') + '" data-lc-series="' + item.key + '">' +
        '<span class="lc-swatch" style="background:' + item.color + '"></span>' +
        '<span>' + escapeHtml(item.name) + '</span>' +
        '<span style="color:' + canvasDeltaColor(delta) + '">' + canvasDeltaText(delta) + '</span></button>';
    }).join('');
    return svg + '<div class="lc-legend">' + legend + '</div>';
  }

  function canvasHistoryHtml(chrono) {
    if (chrono.length < 2) {
      const when = canvasDateLabel(chrono[0] && chrono[0].date);
      return '<p class="lc-lead">This is your first picture' + (when ? ', from ' + escapeHtml(when) : '') + '. Check in again and the graph starts from here.</p>';
    }
    const views = [
      ['arc', 'Arc'],
      ['patterns', 'Lines'],
      ['snapshot', 'Then and now']
    ].map(([id, label]) =>
      '<button type="button" class="lc-view' + (canvasView === id ? ' active' : '') + '" data-lc-view="' + id + '">' + label + '</button>'
    ).join('');
    let body = '';
    if (canvasView === 'patterns') {
      body = '<p class="lc-lead">Tap a line to hide or show it.</p>' + canvasPatternsSvg(chrono);
    } else if (canvasView === 'snapshot') {
      const first = chrono[0];
      const last = chrono[chrono.length - 1];
      const low = CANVAS_DIMS.reduce((lowest, dim) => last.scores[dim.key] < last.scores[lowest.key] ? dim : lowest, CANVAS_DIMS[0]);
      const rows = CANVAS_DIMS.map((dim) => {
        const change = last.scores[dim.key] - first.scores[dim.key];
        return '<div class="lc-snap-row"><span style="color:' + dim.color + '">' + dim.title + (dim.key === low.key ? ' · lowest today' : '') + '</span>' +
          '<span style="color:' + canvasDeltaColor(change) + '">' + first.scores[dim.key] + ' → ' + last.scores[dim.key] + ' (' + canvasDeltaText(change) + ')</span></div>';
      }).join('');
      body = '<p class="lc-tend"><span style="color:' + low.color + '">' + low.title + '</span> is the lowest area today, at ' + last.scores[low.key] + '. It was ' + first.scores[low.key] + ' on your first picture.</p>' +
        '<div class="lc-radar-wrap">' + canvasRadarSvg(last.scores, first.scores) + '</div>' +
        '<div class="lc-date-span"><span>First · ' + first.overall + '</span><span>Today · ' + last.overall + ' (' + canvasDeltaText(last.overall - first.overall) + ')</span></div>' +
        rows;
    } else {
      const overallDelta = canvasDelta(chrono, 'overall');
      body = canvasTrendSvg(chrono.map((entry) => entry.overall), '#F5C842', 96, true) +
        '<div class="lc-date-span"><span>' + escapeHtml(canvasDateLabel(chrono[0].date)) + '</span><span>' + canvasDeltaText(overallDelta) + ' since you began</span><span>' + escapeHtml(canvasDateLabel(chrono[chrono.length - 1].date)) + '</span></div>';
      CANVAS_DIMS.forEach((dim) => {
        const delta = canvasDelta(chrono, dim.key);
        const latest = chrono[chrono.length - 1].scores[dim.key];
        body += '<div class="lc-area"><div class="lc-area-head"><span style="color:' + dim.color + '">' + dim.title + '</span><span>' + latest + ' <span style="color:' + canvasDeltaColor(delta) + '">' + canvasDeltaText(delta) + '</span></span></div>' +
          canvasTrendSvg(chrono.map((entry) => entry.scores[dim.key]), dim.color, 48, false) + '</div>';
      });
    }
    const record = '<p class="lc-kicker">Record</p>' + chrono.slice().reverse().slice(0, 8).map((entry) =>
      '<div class="lc-record-row"><span>' + escapeHtml(canvasDateLabel(entry.date) || 'First picture') + '</span><span>' + entry.overall + ' / 100</span></div>'
    ).join('');
    const more = chrono.length > 8 ? '<p class="lc-lead">Showing the latest 8 of ' + chrono.length + ' check-ins.</p>' : '';
    return '<div class="lc-views" role="tablist">' + views + '</div>' + body + '<div class="lc-record">' + record + '</div>' + more;
  }

  function canvasCheckinHtml(scores) {
    if (!canvasCheckinOpen) {
      return '<div class="lc-actions"><button type="button" class="btn btn-gold" data-lc-checkin>Check in again</button>' +
        '<a class="btn btn-outline" href="' + escapeHtml(innerCompassHref()) + '">Open your Inner Compass</a></div>';
    }
    const source = canvasDraft || scores;
    const sliders = CANVAS_DIMS.map((dim) => {
      const value = source[dim.key];
      const note = canvasTexts && canvasTexts[dim.key] ? '<p class="lc-note">' + escapeHtml(canvasTexts[dim.key]) + '</p>' : '';
      return '<div class="lc-slider"><div class="lc-bar-head"><span class="lc-bar-name" style="color:' + dim.color + '">' + dim.title + '</span><span class="lc-bar-num" data-lc-val="' + dim.key + '">' + value + '</span></div>' +
        '<p class="lc-note">' + escapeHtml(dim.question) + '</p>' + note +
        '<input type="range" min="0" max="100" value="' + value + '" data-lc-slider="' + dim.key + '" style="accent-color:' + dim.color + ';color:' + dim.color + '" aria-label="' + escapeHtml(dim.title) + '"></div>';
    }).join('');
    return '<div class="lc-checkin"><p class="lc-kicker">Check in</p><h3 class="lc-title">Where are these five today?</h3>' + sliders +
      '<div class="lc-actions"><button type="button" class="btn btn-gold" data-lc-save>Save this check-in</button><button type="button" class="btn btn-outline" data-lc-cancel>Cancel</button></div></div>';
  }

  function renderLifeCanvas() {
    const pane = document.getElementById('pane-canvas');
    if (!pane) return;
    if (!deepNestId) {
      pane.innerHTML = '<div class="lc-shell"><article class="lc-card"><p class="lc-kicker">Life Canvas</p><h2 class="lc-title">Five parts of your life, on one page</h2><p class="lc-lead">Passion and purpose, connections, spaces, resources, and energy. They fill in when you take the Inner Compass, and later check-ins stay on this tab.</p><div class="lc-empty-actions"><a class="btn btn-ember" href="/inner-compass/?from=nest">Take the Inner Compass →</a></div></article></div>';
      return;
    }
    if (!canvasScores) {
      pane.innerHTML = '<div class="lc-shell"><article class="lc-card"><p class="lc-kicker">Life Canvas</p><h2 class="lc-title">Your Inner Compass is linked</h2><p class="lc-lead">The five scores show up here after the Life Canvas questions in the Inner Compass. Check-ins after that stay on this tab.</p><div class="lc-empty-actions"><a class="btn btn-ember" href="' + escapeHtml(innerCompassHref()) + '">Open the Inner Compass →</a></div></article></div>';
      return;
    }
    const scores = canvasScores;
    const overall = canvasOverall(scores);
    const chrono = canvasChrono(canvasHistory);
    const latest = chrono[chrono.length - 1];
    const delta = canvasDelta(chrono, 'overall');
    const bars = CANVAS_DIMS.map((dim) => {
      const note = canvasTexts && canvasTexts[dim.key] ? '<p class="lc-note">' + escapeHtml(canvasTexts[dim.key]) + '</p>' : '';
      return '<div><div class="lc-bar-head"><span class="lc-bar-name" style="color:' + dim.color + '">' + dim.title + '</span><span class="lc-bar-num" style="color:' + dim.color + '">' + scores[dim.key] + '</span></div><div class="lc-track"><div class="lc-fill" data-width="' + scores[dim.key] + '" style="background:' + dim.color + '"></div></div>' + note + '</div>';
    }).join('');
    const synthesis = canvasSynthesis
      ? '<p class="lc-note">' + escapeHtml(canvasSynthesis) + '</p>'
      : (deepReadPaid ? '' : '<p class="lc-note">The written Life Canvas read is part of the full Inner Compass.</p>');
    const status = canvasStatus
      ? '<p class="lc-status' + (canvasStatus.indexOf('Could not') === 0 ? ' is-error' : '') + '">' + escapeHtml(canvasStatus) + '</p>'
      : '';
    const when = latest ? canvasDateLabel(latest.date) : '';
    pane.innerHTML = '<div class="lc-shell"><article class="lc-card"><p class="lc-kicker">Life Canvas</p><div class="lc-hero">' +
      canvasRadarSvg(scores) +
      '<div><h2 class="lc-title">Today</h2><div class="lc-overall-num">' + overall + '</div><p class="lc-overall-meta">out of 100' +
      (chrono.length > 1 ? ' · <span class="lc-delta" style="color:' + canvasDeltaColor(delta) + '">' + canvasDeltaText(delta) + ' since you began</span>' : '') +
      (when ? ' · ' + escapeHtml(when) : '') + '</p></div></div><div class="lc-bars">' + bars + '</div>' + synthesis + status + '</article>' +
      '<article class="lc-card"><p class="lc-kicker">History</p><h2 class="lc-title">How this has moved</h2>' + canvasHistoryHtml(chrono) + '</article>' +
      '<article class="lc-card">' + canvasCheckinHtml(scores) + '</article></div>';
    requestAnimationFrame(() => {
      if (!pane.isConnected) return;
      pane.querySelectorAll('.lc-fill').forEach((el) => {
        el.style.width = (el.dataset.width || '0') + '%';
      });
      pane.querySelectorAll('[data-lc-slider]').forEach(paintCanvasSlider);
    });
  }

  function paintCanvasSlider(input) {
    const color = input.style.accentColor || '#F5C842';
    const pct = Number(input.value);
    input.style.background = 'linear-gradient(90deg, ' + color + ' ' + pct + '%, rgba(127,127,127,0.22) ' + pct + '%)';
  }

  function readCanvasDraftFromDom() {
    const pane = document.getElementById('pane-canvas');
    if (!pane) return;
    const inputs = pane.querySelectorAll('[data-lc-slider]');
    if (!inputs.length) return;
    canvasDraft = {};
    inputs.forEach((input) => {
      canvasDraft[input.dataset.lcSlider] = Number(input.value);
    });
  }

  async function saveLifeCanvasCheckin(btn) {
    if (!deepNestId || !canvasScores) return;
    const pane = document.getElementById('pane-canvas');
    const next = {};
    CANVAS_DIMS.forEach((dim) => {
      const input = pane && pane.querySelector('[data-lc-slider="' + dim.key + '"]');
      const n = Number(input && input.value);
      next[dim.key] = Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : canvasScores[dim.key];
    });
    const entry = { scores: next, overall: canvasOverall(next), date: new Date().toISOString() };
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving…';
    }
    try {
      const res = await fetch(ASSESSMENT_WORKER_URL + '/store-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ nestId: deepNestId, canvasScores: next, canvasHistory: [entry] })
      });
      if (!res.ok) throw new Error('save failed');
      canvasScores = next;
      canvasHistory = [entry].concat(canvasHistory).slice(0, 24);
      canvasDraft = null;
      canvasCheckinOpen = false;
      canvasStatus = 'Saved. This check-in is on your history.';
      renderLifeCanvas();
    } catch (err) {
      canvasStatus = 'Could not save that check-in. Try again.';
      canvasCheckinOpen = true;
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Save this check-in';
      }
      const status = document.querySelector('#pane-canvas .lc-status');
      if (status) {
        status.textContent = canvasStatus;
        status.classList.add('is-error');
      } else {
        renderLifeCanvas();
      }
    }
  }

  // tabs
  function setTab(name) {
    document.querySelectorAll('.dash-tab').forEach((el) => el.classList.remove('active'));
    document.querySelectorAll('#view-dashboard .tab-pane').forEach((el) => el.classList.remove('active'));
    const tab = document.getElementById(`tab-${name}`);
    const pane = document.getElementById(`pane-${name}`);
    if (tab) tab.classList.add('active');
    if (pane) pane.classList.add('active');
    const dashGrid = document.getElementById('dash-grid');
    if (dashGrid) dashGrid.classList.toggle('is-ask-tab', name === 'ask');
    if (name === 'canvas') renderLifeCanvas();
    if (name === 'ask') bootGuide();
    if (name === 'journey' && window.LilbirdJourney) window.LilbirdJourney.show();
  }
  window.__nestSetTab = setTab;

  function resetDashboardUi() {
    nestPlusGrantedBy = '';
    setTab('products');
    setDashError('');
    setDashLoading(false);
    chatMsgs = [];
    guideOffered = [];
    const chatWrap = document.getElementById('chat-messages');
    if (chatWrap) chatWrap.innerHTML = '';
    document.getElementById('pane-products').innerHTML = '';
    document.getElementById('pane-profile').innerHTML = '';
    const paneCanvas = document.getElementById('pane-canvas');
    if (paneCanvas) paneCanvas.innerHTML = '';
    canvasScores = null;
    canvasHistory = [];
    canvasSynthesis = '';
    canvasTexts = null;
    canvasCheckinOpen = false;
    canvasDraft = null;
    canvasStatus = '';
    document.getElementById('sidebar-context-card').innerHTML = '';
    const live = document.getElementById('sidebar-live-card');
    if (live) live.innerHTML = '';
    document.getElementById('next-steps-list').innerHTML = '';
    const lettersHost = document.getElementById('nest-letters');
    if (lettersHost) lettersHost.innerHTML = '';
    document.dispatchEvent(new CustomEvent('lilbird-nest-logout'));
    document.getElementById('nav-user-name').textContent = '';
    document.getElementById('nav-plan')?.classList.add('hidden');
    const rdCard = document.getElementById('sidebar-relationship-card');
    if (rdCard) rdCard.innerHTML = '';
    if (window.LilbirdJourney) window.LilbirdJourney.reset();
    const btn = document.getElementById('btn-nav-profile');
    if (btn) {
      btn.classList.remove('has-photo');
      btn.innerHTML = '<i class="ti ti-user"></i>';
    }
  }
  window.__nestJourneyHost = {
    sb,
    authHeaders,
    setTab,
    workerUrl: SOLO_WORKER_URL,
    getUser() { return currentUser; },
  };
  function refreshJourney() {
    if (window.LilbirdJourney) void window.LilbirdJourney.refresh();
  }
  document.addEventListener('lilbird-journey-ready', refreshJourney);

  const tabProducts = document.getElementById('tab-products');
  const tabCanvas = document.getElementById('tab-canvas');
  const tabProfile = document.getElementById('tab-profile');
  const tabJourney = document.getElementById('tab-journey');
  const tabAsk = document.getElementById('tab-ask');
  const btnOpenAsk = document.getElementById('btn-open-ask');
  if (tabProducts) tabProducts.addEventListener('click', () => setTab('products'));
  if (tabCanvas) tabCanvas.addEventListener('click', () => setTab('canvas'));
  if (tabProfile) tabProfile.addEventListener('click', () => openInnerCompassRead());
  if (tabJourney) tabJourney.addEventListener('click', () => setTab('journey'));
  const paneCanvasEl = document.getElementById('pane-canvas');
  if (paneCanvasEl) {
    paneCanvasEl.addEventListener('click', (e) => {
      const view = e.target.closest('[data-lc-view]');
      if (view) {
        readCanvasDraftFromDom();
        canvasView = view.dataset.lcView;
        renderLifeCanvas();
        return;
      }
      const series = e.target.closest('[data-lc-series]');
      if (series) {
        const key = series.dataset.lcSeries;
        if (canvasHiddenSeries[key]) delete canvasHiddenSeries[key];
        else canvasHiddenSeries[key] = true;
        canvasView = 'patterns';
        renderLifeCanvas();
        return;
      }
      if (e.target.closest('[data-lc-checkin]')) {
        canvasCheckinOpen = true;
        canvasDraft = null;
        canvasStatus = '';
        renderLifeCanvas();
        return;
      }
      if (e.target.closest('[data-lc-cancel]')) {
        canvasCheckinOpen = false;
        canvasDraft = null;
        renderLifeCanvas();
        return;
      }
      const save = e.target.closest('[data-lc-save]');
      if (save) void saveLifeCanvasCheckin(save);
    });
    paneCanvasEl.addEventListener('input', (e) => {
      const input = e.target.closest('[data-lc-slider]');
      if (!input) return;
      const label = paneCanvasEl.querySelector('[data-lc-val="' + input.dataset.lcSlider + '"]');
      if (label) label.textContent = input.value;
      paintCanvasSlider(input);
      canvasDraft = canvasDraft || {};
      canvasDraft[input.dataset.lcSlider] = Number(input.value);
    });
  }

  // chat
  function syncGuideAccess() {
    const open = hasNestPlus();
    const stage = document.getElementById('guide-stage');
    if (stage) stage.classList.toggle('is-locked', !open);
    const copy = document.getElementById('guide-side-copy');
    if (copy) {
      copy.textContent = "The next best thing to being in the room with Luke.";
    }
  }
  function renderChatMsg(role, content, tool) {
    const row = document.createElement('div');
    row.className = `msg ${role === 'user' ? 'user' : 'bot'}`;
    const text = document.createElement('p');
    text.textContent = content;
    row.appendChild(text);
    if (tool && tool.id && tool.title) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'guide-tool';
      const title = document.createElement('strong');
      title.textContent = tool.title;
      const meta = document.createElement('span');
      meta.textContent = tool.minutes ? tool.minutes + ' in My Journey' : 'Open in My Journey';
      card.append(title, meta);
      card.addEventListener('click', () => {
        if (window.LilbirdJourney && window.LilbirdJourney.openTool) window.LilbirdJourney.openTool(tool.id);
      });
      row.appendChild(card);
    }
    const wrap = document.getElementById('chat-messages');
    wrap.appendChild(row);
    wrap.scrollTop = wrap.scrollHeight;
  }
  function bootGuide() {
    syncGuideAccess();
    if (!hasNestPlus() || chatMsgs.length) return;
    const greet = "I'm here with you. Tell me what's in front of you, and we'll stay with one thing.";
    chatMsgs.push({ role: 'assistant', content: greet });
    renderChatMsg('assistant', greet);
  }
  if (tabAsk) tabAsk.addEventListener('click', () => setTab('ask'));
  if (btnOpenAsk) btnOpenAsk.addEventListener('click', () => setTab('ask'));
  const chatSend = document.getElementById('chat-send');
  const chatInput = document.getElementById('chat-input');
  if (chatSend) chatSend.addEventListener('click', sendChat);
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChat();
      }
    });
  }
  const guideUpgrade = document.getElementById('guide-upgrade');
  if (guideUpgrade) guideUpgrade.addEventListener('click', (e) => void startUpgrade('nest_plus', e.currentTarget));

  async function sendChat() {
    if (!hasNestPlus()) {
      syncGuideAccess();
      return;
    }
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    chatMsgs.push({ role: 'user', content: text });
    renderChatMsg('user', text);
    const portrait = document.getElementById('luke-portrait');
    if (portrait) portrait.classList.add('is-thinking');
    try {
      const response = await fetch(CHAT_WORKER_URL + 'guide', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, await authHeaders()),
        body: JSON.stringify({ messages: chatMsgs.slice(-12), offered: guideOffered.slice() })
      });
      let data = null;
      try { data = await response.json(); } catch (_) { data = null; }
      if (data && data.error === 'nest_plus_required') {
        const stage = document.getElementById('guide-stage');
        if (stage) stage.classList.add('is-locked');
        return;
      }
      const msg = response.ok && !(data && data.error) ? textFromChatPayload(data) : '';
      if (!msg) {
        renderChatMsg('assistant', "I couldn't get a reply just now. Try again in a moment.");
        return;
      }
      chatMsgs.push({ role: 'assistant', content: msg });
      const tool = data && data.tool && data.tool.id ? data.tool : null;
      if (tool) guideOffered.push(tool.id);
      renderChatMsg('assistant', msg, tool);
    } catch (e) {
      renderChatMsg('assistant', "I couldn't reach the guide just now. Try again in a moment.");
    } finally {
      if (portrait) portrait.classList.remove('is-thinking');
    }
  }
  function textFromChatPayload(data) {
    if (!data || typeof data !== 'object') return '';
    const blocks = Array.isArray(data.content) ? data.content : [];
    const fromBlocks = blocks
      .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text.trim())
      .filter(Boolean)
      .join('\n')
      .trim();
    if (fromBlocks) return fromBlocks;
    if (typeof data.reply === 'string' && data.reply.trim()) return data.reply.trim();
    if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
    return '';
  }

  async function showDashboard(preloadedUser) {
    if (suppressDashboard) return;
    if (passwordSetupPending) {
      showSetPassword();
      return;
    }

    let user = preloadedUser || null;
    if (!user) {
      const { data: sessionData } = await sb.auth.getSession();
      user = sessionData.session?.user || null;
    }
    if (!user) {
      showAuth();
      return;
    }

    currentUser = user;
    const authView = document.getElementById('view-auth');
    const dashView = document.getElementById('view-dashboard');
    if (authView) authView.classList.remove('active');
    if (dashView) dashView.classList.add('active');
    resetLoginButton();
    const preferTab = new URLSearchParams(window.location.search).get('tab');
    setTab(preferTab === 'profile' || preferTab === 'ask' || preferTab === 'canvas' ? preferTab : 'products');
    await hydrateDashboard();
  }

  function showAuth() {
    currentUser = null;
    dashboardHydrateToken++;
    signupInFlight = false;
    resetDashboardUi();
    showAuthViewNow();
    resetLoginButton();
    if (!passwordSetupPending) showSignup();
  }

  async function forceLogout() {
    suppressDashboard = true;
    currentUser = null;
    dashboardHydrateToken++;
    try {
      await sb.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.warn('Nest signOut:', e);
    }
    clearAllSupabaseAuthStorage();
    suppressDashboard = false;
    showAuth();
  }

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      btnLogout.disabled = true;
      btnLogout.textContent = 'Logging out...';
      try {
        await forceLogout();
      } finally {
        resetLogoutButton();
      }
    });
  }

  sb.auth.onAuthStateChange((event, session) => {
    if (suppressDashboard) {
      if (!session?.user) suppressDashboard = false;
      return;
    }
    if (signupInFlight) return;
    if (event === 'PASSWORD_RECOVERY') {
      passwordSetupPending = true;
      showSetPassword();
      return;
    }

    if (event === 'SIGNED_OUT') {
      showAuth();
      return;
    }

    if (
      session?.user &&
      (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')
    ) {
      void showDashboard(session.user);
    }
  });

  function clearAuthParamsFromUrl() {
    try {
      window.history.replaceState({}, '', window.location.pathname);
    } catch (e) {}
  }

  function readAuthHashParams() {
    const raw = (window.location.hash || '').replace(/^#/, '');
    if (!raw) return null;
    return new URLSearchParams(raw);
  }

  function showAuthLinkError(message) {
    showAuth();
    showLogin();
    if (!loginError) return;
    loginError.style.color = '';
    loginError.textContent = message;
  }

  // Magic / confirm / recovery links land with either:
  //   ?code=…          (PKCE — Nest "Email me a sign-in link")
  //   #access_token=…  (implicit — often Supabase dashboard "Send magic link")
  //   #error=…         (expired / already used)
  async function handleEmailConfirmCallback() {
    const hashParams = readAuthHashParams();
    if (hashParams) {
      const hashError = hashParams.get('error');
      const hashDesc = hashParams.get('error_description');
      if (hashError) {
        clearAuthParamsFromUrl();
        const detail = hashDesc ? decodeURIComponent(hashDesc.replace(/\+/g, ' ')) : '';
        showAuthLinkError(
          detail ||
            'That sign-in link is invalid or has expired. Request a new one from Nest (Email me a sign-in link).'
        );
        return null;
      }

      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      if (accessToken && refreshToken) {
        if (hashParams.get('type') === 'recovery' || pwSetupFlagSet()) passwordSetupPending = true;
        const { data, error } = await sb.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        clearAuthParamsFromUrl();
        if (error) {
          showAuthLinkError(error.message || 'Could not complete sign-in from that link. Request a new one.');
          return null;
        }
        return data.session?.user || null;
      }
    }

    const params = new URLSearchParams(window.location.search);
    const authCode = params.get('code');
    if (!authCode) return null;

    if (pwSetupFlagSet()) passwordSetupPending = true;
    const { data, error } = await sb.auth.exchangeCodeForSession(authCode);
    clearAuthParamsFromUrl();
    if (error) {
      showAuthLinkError(
        'That sign-in link did not work (expired, already used, or opened in a different browser). Request a new one from Nest.'
      );
      return null;
    }

    return data.session?.user || null;
  }

  const btnNavProfile = document.getElementById('btn-nav-profile');
  if (btnNavProfile) {
    btnNavProfile.addEventListener('click', () => {
      goToPhoto();
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (
      document.visibilityState === 'visible' &&
      currentUser &&
      document.getElementById('view-dashboard')?.classList.contains('active')
    ) {
      void hydrateDashboard();
    }
  });

  async function openMergeLink() {
    const token = new URLSearchParams(window.location.search).get('merge');
    if (!token) return;
    const banner = document.getElementById('merge-banner');
    try {
      const res = await fetch(SOLO_WORKER_URL + '/merge-open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json().catch(() => ({}));
      const text = data.message || data.error || (data.verified ? 'This inbox is confirmed. Log into the Nest you want to keep and finish from Inner Compass.' : '');
      if (banner && text) {
        banner.textContent = text;
        banner.classList.remove('hidden');
      }
    } catch (e) {
      if (banner) {
        banner.textContent = 'This confirmation link could not be opened. Try it again from the email.';
        banner.classList.remove('hidden');
      }
    }
  }

  (async function init() {
    resetLoginButton();
    void openMergeLink();

    if (wantsLogout) {
      try {
        await sb.auth.signOut({ scope: 'local' });
      } catch (e) {
        console.warn('Nest signOut:', e);
      }
      clearAllSupabaseAuthStorage();
      showAuthViewNow();
      suppressDashboard = false;
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch (e) {}
      return;
    }

    const confirmedUser = await handleEmailConfirmCallback();
    if (confirmedUser) {
      await showDashboard(confirmedUser);
      return;
    }

    const { data } = await sb.auth.getSession();
    if (!data.session?.user) {
      showAuth();
      return;
    }

    if (pwSetupFlagSet()) passwordSetupPending = true;
    await showDashboard();
  })();
})();
