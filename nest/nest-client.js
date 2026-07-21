(function () {
  const SUPABASE_URL = 'https://mebqqzbuwkogdxvnihrq.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lYnFxemJ1d2tvZ2R4dm5paHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTMzMjAsImV4cCI6MjA5MzQ4OTMyMH0.AzBotw2siyolNEbzd9cp4VT9FjBrGetiZxGOZsOGZVU';
  const CHAT_WORKER_URL = 'https://lilbird-chat.cwwq46sn7m.workers.dev/';
  const ASSESSMENT_WORKER_URL = 'https://lilbird-assessment.cwwq46sn7m.workers.dev';
  // Optional secure endpoint for sending a Resend "Your Nest is ready" email.
  // Leave empty unless you have a backend endpoint configured.
  const NEST_WELCOME_EMAIL_ENDPOINT = 'https://worker-solo.cwwq46sn7m.workers.dev/nest-welcome-email';
  const LCI_BOOKING_URL = 'https://cal.com/luke-haythorpe/life-change-session';

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
  let courseProfile = null;
  let sessionProgress = [];
  let deepProfile = null;
  let deepNestId = null;
  let intensiveEnrolment = null;
  let lciSessions = [];
  let chatMsgs = [];
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
      return 'Could not log in. If you just created an account, open the confirmation email first — until then login will fail. Otherwise check your password or use Forgot password.';
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

  // auth tabs
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const formLogin = document.getElementById('form-login');
  const formSignup = document.getElementById('form-signup');
  const loginError = document.getElementById('login-error');
  const signupError = document.getElementById('signup-error');

  function swapAuth(isSignup) {
    tabLogin.classList.toggle('active', !isSignup);
    tabSignup.classList.toggle('active', isSignup);
    formLogin.classList.toggle('hidden', isSignup);
    formSignup.classList.toggle('hidden', !isSignup);
  }
  tabLogin.addEventListener('click', () => {
    swapAuth(false);
    signupError.textContent = '';
    clearSignupSuccess();
  });
  tabSignup.addEventListener('click', () => {
    swapAuth(true);
    signupError.textContent = '';
    clearSignupSuccess();
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
      loginError.textContent = 'Enter your email first to reset password.';
      return;
    }
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: NEST_AUTH_REDIRECT
    });
    loginError.textContent = error ? (error.message || 'Could not send reset email.') : 'Password reset email sent.';
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
      : 'Confirmation email sent — check inbox and spam, then click the link (it should open this Nest page).';
  });

  document.getElementById('btn-magic-link').addEventListener('click', async () => {
    loginError.textContent = '';
    loginError.style.color = '';
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    if (!email) {
      loginError.textContent = 'Enter your email first, then request a sign-in link.';
      return;
    }
    const btn = document.getElementById('btn-magic-link');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending link…';
    }
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: NEST_AUTH_REDIRECT }
    });
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Email me a sign-in link';
    }
    loginError.style.color = error ? '' : 'var(--gold)';
    loginError.textContent = error
      ? error.message || 'Could not send sign-in link.'
      : 'Sign-in link sent — check inbox and spam. Click it to open your Nest (no password needed for that login).';
  });

  function resetSignupButton() {
    const btn = document.getElementById('btn-signup');
    if (!btn) return;
    btn.disabled = false;
    btn.textContent = 'Create account →';
  }

  function showSignupSuccess(message) {
    const note = document.getElementById('signup-note');
    signupError.textContent = '';
    if (note) {
      note.textContent = message;
      note.classList.add('auth-success');
      note.classList.remove('auth-note');
    }
  }

  function clearSignupSuccess() {
    const note = document.getElementById('signup-note');
    if (!note) return;
    note.classList.remove('auth-success');
    note.classList.add('auth-note');
    note.textContent =
      'Nest uses the same login as the Solo course. If you already bought Solo, log in with that email instead of creating again.';
  }

  formSignup.addEventListener('submit', async (e) => {
    e.preventDefault();
    signupError.textContent = '';
    clearSignupSuccess();

    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim().toLowerCase();
    const password = document.getElementById('signup-password').value;
    const btnSignup = document.getElementById('btn-signup');

    if (password.length < 8) {
      signupError.textContent = 'Password must be at least 8 characters.';
      return;
    }

    signupInFlight = true;
    if (btnSignup) {
      btnSignup.disabled = true;
      btnSignup.textContent = 'Creating account…';
    }

    try {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: NEST_AUTH_REDIRECT
        }
      });

      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('already registered') || msg.includes('already been registered')) {
          signupError.textContent =
            'An account with this email already exists — often from the Solo course or an earlier signup. Switch to Log in, or use Forgot password on that tab.';
          document.getElementById('login-email').value = email;
          swapAuth(false);
          return;
        }
        signupError.textContent = error.message || 'Could not create account.';
        return;
      }

      const identities = data.user?.identities;
      const hasNewIdentity = Array.isArray(identities) && identities.length > 0;

      if (data.session?.user) {
        await sendNestWelcomeEmail(email, name || email, data.session.user.id);
        await showDashboard(data.session.user);
        return;
      }

      // Confirm-email is off in Supabase but signUp sometimes returns user without session.
      if (data.user && hasNewIdentity) {
        const signIn = await sb.auth.signInWithPassword({ email, password });
        if (signIn.data.session?.user) {
          await sendNestWelcomeEmail(email, name || email, signIn.data.session.user.id);
          await showDashboard(signIn.data.session.user);
          return;
        }
        if (signIn.error) {
          signupError.textContent =
            'Account was created but automatic login failed: ' +
            loginErrorMessage(signIn.error) +
            ' Try the Log in tab with the same password, or Forgot password.';
          document.getElementById('login-email').value = email;
          swapAuth(false);
          return;
        }
      }

      if (data.user && !hasNewIdentity && !data.session) {
        showSignupSuccess(
          'If you already have an account (e.g. Solo), use Log in. Otherwise try again or use Forgot password.'
        );
        document.getElementById('login-email').value = email;
        swapAuth(false);
        return;
      }

      showSignupSuccess('Account may have been created. Try Log in with your password, or Forgot password.');
      document.getElementById('login-email').value = email;
      swapAuth(false);
    } catch (err) {
      console.error('Nest signup:', err);
      signupError.textContent = 'Something went wrong. Please try again.';
    } finally {
      signupInFlight = false;
      resetSignupButton();
    }
  });

  async function sendNestWelcomeEmail(email, name, userId) {
    if (!NEST_WELCOME_EMAIL_ENDPOINT) return;
    try {
      await fetch(NEST_WELCOME_EMAIL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          user_id: userId || undefined,
          subject: 'Your Nest is ready',
          steps: ['Log in', 'See your products', 'Complete next steps']
        })
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
        sb.from('user_entitlements').select('product,active').eq('user_id', uid).eq('active', true),
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

      if (deepNestId) {
        try {
          const res = await fetch(ASSESSMENT_WORKER_URL + '/get-profile?nestId=' + encodeURIComponent(deepNestId));
          if (res.ok) {
            const payload = await res.json();
            deepProfile = parseAssessmentProfile(payload);
          }
        } catch (e) {
          console.error('Could not load deep profile:', e);
        }
      }

      document.getElementById('nav-user-name').textContent =
        courseProfile?.full_name || currentUser.user_metadata?.full_name || currentUser.email;

      document.getElementById('profile-dot').classList.toggle('hidden', !hasInnerCompassComplete());
      renderNextSteps();
      renderProducts();
      renderProfile();
      renderSidebar();
    } catch (err) {
      console.error('Nest hydrateDashboard:', err);
      if (token === dashboardHydrateToken) {
        setDashError('Could not load your Nest. Please refresh the page or try again.');
      }
    } finally {
      if (token === dashboardHydrateToken) setDashLoading(false);
    }
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
        '<li class="lci-session-empty">Session slots are being set up — refresh in a moment or email hello@lilbird.life.</li>';
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
        <a class="btn btn-outline" href="${workbookHref('roots-and-wings-workbook.html')}">Open workbook</a>
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
            ? 'No sessions left to mark — you may already be up to date.'
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
      steps.push({ done: contractDone, text: contractDone ? 'Agreement signed' : 'Sign the coaching agreement' });
      steps.push({ done: paidDone, text: paidDone ? 'Payment confirmed' : 'Complete Intensive payment' });
      steps.push({
        done: stats.hasRows && stats.allBooked,
        text: stats.allBooked
          ? 'All 8 sessions booked'
          : stats.hasRows
            ? `Book your next session (${stats.remaining} of 8 remaining)`
            : 'Book sessions from your Intensive card'
      });
      steps.push({ done: paidDone, text: 'Open Roots & Wings workbook before session one' });
    } else {
      steps.push({
        done: innerDone,
        text: innerDone
          ? 'Inner Compass completed'
          : hasInner
            ? 'Take your Inner Compass assessment'
            : 'Unlock Inner Compass in your Nest'
      });
      steps.push({ done: hasSolo || hasFirstFlight || hasIntensive, text: 'Your Nest account is active' });
      steps.push({ done: hasSolo || hasIntensive || hasFirstFlight, text: hasSolo ? 'Continue your Solo journey' : 'Unlock your next product in the Nest' });
      steps.push({
        done: innerDone,
        text: innerDone ? 'Profile ready in My profile' : 'Complete Inner Compass to fill My profile'
      });
    }

    const ul = document.getElementById('next-steps-list');
    ul.innerHTML = steps
      .map((s) => `<li class="${s.done ? 'done' : ''}">${s.done ? '✓' : '○'} ${escapeHtml(s.text)}</li>`)
      .join('');
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
      ASSESSMENT_WORKER_URL + '/get-profile?nestId=' + encodeURIComponent(nestId)
    );
    if (!res.ok) return null;
    const payload = await res.json();
    return parseAssessmentProfile(payload);
  }

  async function linkInnerCompassToAccount(btn) {
    const hint =
      'Paste your Inner Compass results link from email\n(for example: lilbird.life/deep-profile.html?nest=…)\n\nOr paste the nest id only:';
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
          'That link did not load a saved read. Open it in a new tab — if it works there, copy the full URL again. The email on the assessment can differ from your Nest login; that is OK.'
        );
        return;
      }

      btn.textContent = 'Connecting…';
      const { error } = await sb.rpc('link_deep_profile_to_user', { p_nest_id: nestId });
      if (error) {
        setDashError(
          error.message.includes('function') || error.code === 'PGRST202'
            ? 'Database not ready — run nest/link-inner-compass-grant-on-link.sql in Supabase, then try again.'
            : 'Could not save the link. Try again or email hello@lilbird.life.'
        );
        return;
      }

      deepNestId = nestId;
      deepProfile = profile;
      if (!entitlements.has('inner_compass')) {
        entitlements.add('inner_compass');
      }

      await hydrateDashboard();
      if (hasInnerCompassComplete()) {
        btn.textContent = 'Connected ✓';
        setTimeout(() => {
          btn.textContent = original;
          btn.disabled = false;
        }, 2500);
        return;
      }
      setDashError('Link saved — refresh the page if your profile does not appear.');
    } catch (e) {
      console.error('link_deep_profile_to_user:', e);
      setDashError('Could not connect your results. Try again or email hello@lilbird.life.');
    }

    btn.textContent = original;
    btn.disabled = false;
  }

  function hasInnerCompassAccess() {
    return entitlements.has('inner_compass') || !!deepNestId || hasInnerCompassComplete();
  }

  function hasInnerCompassComplete() {
    return !!(deepNestId && deepProfile);
  }

  function innerCompassHref() {
    const base = '/deep-profile.html';
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
        <span class="ic-snap-cta">Open your full read →</span>
      </a>`;
  }

  function workbookHref(filename) {
    return '/workbooks/' + filename + '?from=nest';
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
          <article class="product-card ic-snapshot-card">
            ${renderInnerCompassSnapshotMarkup('dashboard')}
          </article>`;
        }
        return `
          <article class="product-card">
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
        <article class="product-card locked">
          <span class="lock-pill"><i class="ti ti-lock"></i> not yet unlocked</span>
          <p class="eyebrow">assessment</p>
          <h3>Inner Compass read</h3>
          <p>Understand your wiring. The foundation everything else builds on.</p>
          ${connectBlock}
          <div class="btn-row"><a class="btn btn-ember" href="/deep-profile.html?from=nest">Take the Inner Compass →</a></div>
        </article>`;
    }

    if (key === 'first_flight') {
      if (unlocked) {
        return `
          <article class="product-card">
            <p class="eyebrow">1-to-1 coaching</p>
            <h3>First Flight session</h3>
            <span class="status-badge">booked</span>
            <p>Fill in your workbook before your session. It saves privately to your device.</p>
            <div class="btn-row">
              <a class="btn btn-gold" href="${workbookHref('first-flight-standalone.html')}">Open workbook</a>
              <a class="btn btn-outline" href="https://cal.com/luke-haythorpe/first-flight-intro-session" target="_blank" rel="noopener">View booking</a>
            </div>
          </article>`;
      }
      return `
        <article class="product-card locked">
          <span class="lock-pill"><i class="ti ti-lock"></i> not yet unlocked</span>
          <p class="eyebrow">1-to-1 coaching</p>
          <h3>First Flight session</h3>
          <p>A single session with Luke. Take your Inner Compass read and turn it into a real conversation.</p>
          <div class="btn-row"><a class="btn btn-ember" href="/first-flight/book.html?code=IMREADY">Book now — $149 →</a></div>
        </article>`;
    }

    if (key === 'coaching') {
      const email = encodeURIComponent(currentUser?.email || '');
      const name = encodeURIComponent(courseProfile?.full_name || currentUser?.user_metadata?.full_name || '');
      const href = `/coaching/book.html?from=nest${email ? `&email=${email}` : ''}${name ? `&name=${name}` : ''}`;
      return `
        <article class="product-card">
          <p class="eyebrow">1-to-1 coaching</p>
          <h3>Coaching session</h3>
          <p>One focused session when something specific needs working through — no package required.</p>
          <div class="btn-row"><a class="btn btn-ember" href="${href}">Book coaching — $249 →</a></div>
        </article>`;
    }

    if (key === 'solo_course') {
      const soloUnlocked = hasSoloCourseAccess();
      if (soloUnlocked) {
        const p = progressSummary();
        if (p.pct >= 100) {
          return `
          <article class="product-card">
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
          <article class="product-card">
            <p class="eyebrow">self-guided course</p>
            <h3>Life Change Sessions: Solo</h3>
            <p>${p.pct}% complete · next up: ${escapeHtml(p.next)}</p>
            <div class="progress"><div class="progress-fill" style="width:${p.pct}%"></div></div>
            <div class="btn-row"><a class="btn btn-gold" href="/solo/">Continue →</a></div>
          </article>`;
      }
      return `
        <article class="product-card locked">
          <span class="lock-pill"><i class="ti ti-lock"></i> not yet unlocked</span>
          <p class="eyebrow">self-guided course</p>
          <h3>Life Change Sessions: Solo</h3>
          <p>Eight sessions at your own pace. An AI coaching guide that actually listens.</p>
          <div class="btn-row"><a class="btn btn-ember" href="/solo/">Unlock — $197 →</a></div>
        </article>`;
    }

    if (key === 'life_change_intensive') {
      if (unlocked) {
        return `
          <article class="product-card">
            <p class="eyebrow">full programme</p>
            <h3>Life Change Intensive</h3>
            <span class="status-badge">active</span>
            <p>Book one session at a time — your Nest tracks all 8.</p>
            ${renderLciBookingSection()}
          </article>`;
      }
      return `
        <article class="product-card locked">
          <span class="lock-pill"><i class="ti ti-lock"></i> not yet unlocked</span>
          <p class="eyebrow">full programme</p>
          <h3>Life Change Intensive</h3>
          <p>Eight in-person sessions with Luke. Read the agreement, sign, and pay securely on lilbird.life — then book from your Nest.</p>
          <div class="btn-row">
            <a class="btn btn-ember" href="/intensive/enrol.html?from=nest">Enrol — read agreement &amp; pay →</a>
            <button class="btn btn-outline" data-open-ask>Ask a question</button>
          </div>
        </article>`;
    }
    return '';
  }

  function renderProducts() {
    const productsPane = document.getElementById('pane-products');
    productsPane.innerHTML = `<div class="product-grid">
      ${cardProduct('inner_compass')}
      ${cardProduct('first_flight')}
      ${cardProduct('coaching')}
      ${cardProduct('solo_course')}
      ${cardProduct('life_change_intensive')}
    </div>`;
    productsPane.querySelectorAll('[data-open-ask]').forEach((btn) => {
      btn.addEventListener('click', () => setTab('ask'));
    });
    const claimBtn = productsPane.querySelector('#btn-lci-claim');
    if (claimBtn) {
      claimBtn.addEventListener('click', () => void claimNextLciSession(claimBtn));
    }
    const linkIcBtn = productsPane.querySelector('#btn-link-inner-compass');
    if (linkIcBtn) {
      linkIcBtn.addEventListener('click', () => void linkInnerCompassToAccount(linkIcBtn));
    }
  }

  function renderProfile() {
    const pane = document.getElementById('pane-profile');
    if (hasInnerCompassComplete()) {
      pane.innerHTML = `
        <article class="product-card ic-snapshot-card ic-snapshot-card--profile">
          ${renderInnerCompassSnapshotMarkup('profile')}
        </article>`;
    } else if (hasInnerCompassAccess()) {
      pane.innerHTML = `
        <article class="product-card">
          <p class="eyebrow">my profile</p>
          <h3>Inner Compass profile</h3>
          <span class="status-badge pending">connect your read</span>
          <p>Paste your results link from email on the Inner Compass card (Products tab), or open your read below.</p>
          <div class="btn-row">
            <button type="button" class="btn btn-outline" id="btn-link-inner-compass-profile">Connect my results</button>
            <a class="btn btn-gold" href="${innerCompassHref()}">Take / open Inner Compass →</a>
          </div>
        </article>`;
      const profileLinkBtn = pane.querySelector('#btn-link-inner-compass-profile');
      if (profileLinkBtn) {
        profileLinkBtn.addEventListener('click', () => void linkInnerCompassToAccount(profileLinkBtn));
      }
    } else {
      pane.innerHTML = `
        <article class="product-card locked">
          <span class="lock-pill"><i class="ti ti-lock"></i> not yet unlocked</span>
          <p class="eyebrow">my profile</p>
          <h3>Inner Compass profile</h3>
          <p>Take your Inner Compass read first. Your profile will appear here once unlocked.</p>
          <div class="btn-row"><a class="btn btn-ember" href="/deep-profile.html?from=nest">Take the Inner Compass →</a></div>
        </article>`;
    }
  }

  function renderSidebar() {
    const el = document.getElementById('sidebar-context-card');
    if (entitlements.has('first_flight')) {
      el.innerHTML = `
        <p class="sidebar-eyebrow">session context</p>
        <h4>First Flight booked</h4>
        <p>Session date/time placeholder. Confirm from your Calendly email and complete your workbook first.</p>
        <a class="btn btn-outline full" href="${workbookHref('first-flight-standalone.html')}">Open workbook</a>
        <a class="btn btn-outline full" href="https://cal.com/luke-haythorpe/first-flight-intro-session" target="_blank" rel="noopener">View booking</a>`;
      return;
    }
    if (hasSoloCourseAccess()) {
      const p = progressSummary();
      if (p.pct >= 100) {
        el.innerHTML = `
        <p class="sidebar-eyebrow">session context</p>
        <h4>Solo complete</h4>
        <p>Your plan and takeaways live on the Solo dashboard.</p>
        <a class="btn btn-outline full" href="/solo/?view=plan">Open your plan →</a>
        <a class="btn btn-outline full" href="/solo/?view=sessions">Revisit sessions</a>`;
        return;
      }
      el.innerHTML = `
        <p class="sidebar-eyebrow">session context</p>
        <h4>Solo next step</h4>
        <p>Next up: ${escapeHtml(p.next)}.</p>
        <a class="btn btn-outline full" href="/solo/">Continue Solo →</a>`;
      return;
    }
    el.innerHTML = `
      <p class="sidebar-eyebrow">first flight</p>
      <h4>Book a First Flight</h4>
      <p>One focused session with Luke to turn insight into a real next step.</p>
      <a class="btn btn-ember full" href="/first-flight/book.html?code=IMREADY">Book now — $149 →</a>`;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
  }

  function resetDashboardUi() {
    setTab('products');
    setDashError('');
    setDashLoading(false);
    chatMsgs = [];
    const chatWrap = document.getElementById('chat-messages');
    if (chatWrap) chatWrap.innerHTML = '';
    document.getElementById('pane-products').innerHTML = '';
    document.getElementById('pane-profile').innerHTML = '';
    document.getElementById('sidebar-context-card').innerHTML = '';
    document.getElementById('next-steps-list').innerHTML = '';
    document.getElementById('nav-user-name').textContent = '';
  }
  const tabProducts = document.getElementById('tab-products');
  const tabProfile = document.getElementById('tab-profile');
  const tabAsk = document.getElementById('tab-ask');
  const btnOpenAsk = document.getElementById('btn-open-ask');
  if (tabProducts) tabProducts.addEventListener('click', () => setTab('products'));
  if (tabProfile) tabProfile.addEventListener('click', () => openInnerCompassRead());
  if (tabAsk) tabAsk.addEventListener('click', () => setTab('ask'));
  if (btnOpenAsk) btnOpenAsk.addEventListener('click', () => setTab('ask'));

  // chat
  function renderChatMsg(role, content) {
    const row = document.createElement('div');
    row.className = `msg ${role === 'user' ? 'user' : 'bot'}`;
    row.textContent = content;
    const wrap = document.getElementById('chat-messages');
    wrap.appendChild(row);
    wrap.scrollTop = wrap.scrollHeight;
  }
  function bootChat() {
    if (chatMsgs.length) return;
    const greet = "Hey, it's lil' bird. Ask me anything about your next step, products, or where to start.";
    chatMsgs.push({ role: 'assistant', content: greet });
    renderChatMsg('assistant', greet);
  }
  if (tabAsk) tabAsk.addEventListener('click', bootChat);
  if (btnOpenAsk) btnOpenAsk.addEventListener('click', bootChat);
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

  async function sendChat() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    chatMsgs.push({ role: 'user', content: text });
    renderChatMsg('user', text);
    try {
      const response = await fetch(CHAT_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatMsgs.slice(-12) })
      });
      const data = await response.json();
      const msg = data.reply || data.message || "I can help with that. Tell me a bit more.";
      chatMsgs.push({ role: 'assistant', content: msg });
      renderChatMsg('assistant', msg);
    } catch (e) {
      renderChatMsg('assistant', "I couldn't reach the chat worker just now. Try again in a moment.");
    }
  }

  async function showDashboard(preloadedUser) {
    if (suppressDashboard) return;

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
    resetSignupButton();
    setTab('products');
    await hydrateDashboard();
  }

  function showAuth() {
    currentUser = null;
    dashboardHydrateToken++;
    signupInFlight = false;
    resetDashboardUi();
    showAuthViewNow();
    resetLoginButton();
    resetSignupButton();
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
    btnNavProfile.addEventListener('click', () => openInnerCompassRead());
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

  (async function init() {
    resetLoginButton();
    resetSignupButton();

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

    await showDashboard();
  })();
})();
