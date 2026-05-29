(function () {
  const SUPABASE_URL = 'https://mebqqzbuwkogdxvnihrq.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lYnFxemJ1d2tvZ2R4dm5paHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTMzMjAsImV4cCI6MjA5MzQ4OTMyMH0.AzBotw2siyolNEbzd9cp4VT9FjBrGetiZxGOZsOGZVU';
  const CHAT_WORKER_URL = 'https://lilbird-chat.cwwq46sn7m.workers.dev/';
  const ASSESSMENT_WORKER_URL = 'https://lilbird-assessment.cwwq46sn7m.workers.dev';
  // Optional secure endpoint for sending a Resend "Your Nest is ready" email.
  // Leave empty unless you have a backend endpoint configured.
  const NEST_WELCOME_EMAIL_ENDPOINT = 'https://worker-solo.cwwq46sn7m.workers.dev/nest-welcome-email';

  const { createClient } = supabase;
  const AUTH_STORAGE_KEY = 'lilbird-solo-auth';
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
  let chatMsgs = [];
  let suppressDashboard = false;

  let loginInFlight = false;

  function resetLoginButton() {
    const btnLogin = document.getElementById('btn-login');
    if (!btnLogin) return;
    btnLogin.disabled = false;
    btnLogin.textContent = 'Log in →';
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

  function showSessionInfo(user, entitlementCount) {
    const el = document.getElementById('dash-session-info');
    if (!el || !user) return;

    const email = (user.email || '').toLowerCase();
    const id = user.id || '';
    let text =
      'Signed in as ' +
      (user.email || '(no email)') +
      ' · user id ' +
      id +
      ' · ' +
      entitlementCount +
      ' entitlement(s) loaded for this id';

    el.classList.remove('warn');
    if (entitlementCount === 0) {
      el.classList.add('warn');
      text +=
        ' · No entitlements for this user id. In Supabase, grant rows in user_entitlements where user_id = ' +
        id;
    }

    el.textContent = text;
    el.classList.remove('hidden');
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
  if (wantsLogout) {
    suppressDashboard = true;
    clearAllSupabaseAuthStorage();
    showAuthViewNow();
  }

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
  tabLogin.addEventListener('click', () => swapAuth(false));
  tabSignup.addEventListener('click', () => swapAuth(true));

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    loginError.style.color = '';
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;

    loginInFlight = true;
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
      btnLogin.disabled = true;
      btnLogin.textContent = 'Logging in...';
    }

    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });

      if (error) {
        loginError.textContent = error.message || 'Could not log in.';
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
      loginInFlight = false;
      resetLoginButton();
    }
  });

  document.getElementById('btn-forgot').addEventListener('click', async () => {
    loginError.textContent = '';
    const email = document.getElementById('login-email').value.trim();
    if (!email) {
      loginError.textContent = 'Enter your email first to reset password.';
      return;
    }
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/nest/'
    });
    loginError.textContent = error ? (error.message || 'Could not send reset email.') : 'Password reset email sent.';
  });

  formSignup.addEventListener('submit', async (e) => {
    e.preventDefault();
    signupError.textContent = '';
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    if (password.length < 8) {
      signupError.textContent = 'Password must be at least 8 characters.';
      return;
    }
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    });
    if (error) {
      signupError.textContent = error.message || 'Could not create account.';
      return;
    }
    if (data.user) {
      await sendNestWelcomeEmail(email, name || email);
    }
  });

  async function sendNestWelcomeEmail(email, name) {
    if (!NEST_WELCOME_EMAIL_ENDPOINT) return;
    try {
      await fetch(NEST_WELCOME_EMAIL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
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
    const uid = currentUser.id;
    setDashError('');
    setDashLoading(true);

    try {
      const [entRes, courseRes, progressRes, linkRes] = await Promise.all([
        sb.from('user_entitlements').select('product,active').eq('user_id', uid).eq('active', true),
        sb.from('course_users').select('*').eq('id', uid).maybeSingle(),
        sb.from('session_progress').select('*').eq('user_id', uid).order('session_number'),
        sb.from('deep_profile_links').select('nest_id').eq('user_id', uid).maybeSingle()
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
      deepProfile = null;

      if (deepNestId) {
        try {
          const res = await fetch(ASSESSMENT_WORKER_URL + '/get-profile?nestId=' + encodeURIComponent(deepNestId));
          if (res.ok) {
            const payload = await res.json();
            deepProfile = payload?.profile || null;
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
      showSessionInfo(currentUser, entitlements.size);
    } finally {
      setDashLoading(false);
    }
  }

  function renderNextSteps() {
    const steps = [];
    const hasInner = entitlements.has('inner_compass');
    const innerDone = hasInnerCompassComplete();
    const hasSolo = entitlements.has('solo_course');
    const hasFirstFlight = entitlements.has('first_flight');
    const hasIntensive = entitlements.has('life_change_intensive');

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

    const ul = document.getElementById('next-steps-list');
    ul.innerHTML = steps
      .map((s) => `<li class="${s.done ? 'done' : ''}">${s.done ? '✓' : '○'} ${escapeHtml(s.text)}</li>`)
      .join('');
  }

  function hasInnerCompassComplete() {
    return !!(deepNestId && deepProfile);
  }

  function innerCompassHref() {
    const base = '/deep-profile.html?from=nest';
    if (hasInnerCompassComplete()) {
      return base + '&nest=' + encodeURIComponent(deepNestId);
    }
    return base;
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
      if (unlocked) {
        const done = hasInnerCompassComplete();
        if (done) {
          const arch = deepProfile.archetypePlain || deepProfile.archetype || 'Your read';
          const mbti = deepProfile.mbti || deepProfile.likelyCoreMbti || '';
          const enne = deepProfile.enneagram || deepProfile.likelyCoreEnneagram || '';
          const tags = [arch, mbti, enne].filter(Boolean).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');
          return `
          <article class="product-card">
            <p class="eyebrow">assessment</p>
            <h3>Inner Compass read</h3>
            <span class="status-badge">complete</span>
            <div class="tag-row">${tags}</div>
            <p>Your foundational wiring read is ready to revisit.</p>
            <div class="btn-row"><a class="btn btn-gold" href="${innerCompassHref()}">View full read →</a></div>
          </article>`;
        }
        return `
          <article class="product-card">
            <p class="eyebrow">assessment</p>
            <h3>Inner Compass read</h3>
            <span class="status-badge pending">ready to begin</span>
            <p>You have access. Take the assessment to generate your personal read.</p>
            <div class="btn-row"><a class="btn btn-gold" href="${innerCompassHref()}">Take the Inner Compass →</a></div>
          </article>`;
      }
      return `
        <article class="product-card locked">
          <span class="lock-pill"><i class="ti ti-lock"></i> not yet unlocked</span>
          <p class="eyebrow">assessment</p>
          <h3>Inner Compass read</h3>
          <p>Understand your wiring. The foundation everything else builds on.</p>
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
              <a class="btn btn-outline" href="https://calendly.com/lilbirdlifecoaching/first-flight-session">View booking</a>
            </div>
          </article>`;
      }
      return `
        <article class="product-card locked">
          <span class="lock-pill"><i class="ti ti-lock"></i> not yet unlocked</span>
          <p class="eyebrow">1-to-1 coaching</p>
          <h3>First Flight session</h3>
          <p>A single session with Luke. Take your Inner Compass read and turn it into a real conversation.</p>
          <div class="btn-row"><a class="btn btn-ember" href="https://calendly.com/lilbirdlifecoaching/first-flight-session">Book now — $149 →</a></div>
        </article>`;
    }

    if (key === 'solo_course') {
      if (unlocked) {
        const p = progressSummary();
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
            <p>Your Roots & Wings workbook is ready. Fill it in and bring it to each session.</p>
            <div class="btn-row"><a class="btn btn-gold" href="${workbookHref('roots-and-wings-workbook.html')}">Open workbook →</a></div>
          </article>`;
      }
      return `
        <article class="product-card locked">
          <span class="lock-pill"><i class="ti ti-lock"></i> not yet unlocked</span>
          <p class="eyebrow">full programme</p>
          <h3>Life Change Intensive</h3>
          <p>Eight guided sessions with Luke. The deepest version of the work.</p>
          <div class="btn-row">
            <a class="btn btn-ember" href="https://calendly.com/lilbirdlifecoaching/life-change-intensive">Book now →</a>
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
      ${cardProduct('solo_course')}
      ${cardProduct('life_change_intensive')}
    </div>`;
    productsPane.querySelectorAll('[data-open-ask]').forEach((btn) => {
      btn.addEventListener('click', () => setTab('ask'));
    });
  }

  function renderProfile() {
    const pane = document.getElementById('pane-profile');
    if (entitlements.has('inner_compass') && hasInnerCompassComplete()) {
      pane.innerHTML = `
        <article class="product-card">
          <p class="eyebrow">my profile</p>
          <h3>${escapeHtml(deepProfile.archetypePlain || deepProfile.archetype || 'Your Inner Compass read')}</h3>
          <div class="tag-row">
            <span class="tag">${escapeHtml(deepProfile.mbti || deepProfile.likelyCoreMbti || 'MBTI')}</span>
            <span class="tag">${escapeHtml(deepProfile.enneagram || deepProfile.likelyCoreEnneagram || 'Enneagram')}</span>
            <span class="tag">${escapeHtml(deepProfile.attachment || deepProfile.likelyCoreAttachment || 'Attachment')}</span>
          </div>
          <p>Your profile is loaded and ready to revisit.</p>
          <div class="btn-row"><a class="btn btn-gold" href="${innerCompassHref()}">Open Inner Compass result →</a></div>
        </article>`;
    } else if (entitlements.has('inner_compass')) {
      pane.innerHTML = `
        <article class="product-card">
          <p class="eyebrow">my profile</p>
          <h3>Inner Compass profile</h3>
          <span class="status-badge pending">not started</span>
          <p>You have access. Complete the Inner Compass and your profile will appear here.</p>
          <div class="btn-row"><a class="btn btn-gold" href="${innerCompassHref()}">Take the Inner Compass →</a></div>
        </article>`;
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
        <a class="btn btn-outline full" href="https://calendly.com/lilbirdlifecoaching/first-flight-session">View booking</a>`;
      return;
    }
    if (entitlements.has('solo_course')) {
      const p = progressSummary();
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
      <a class="btn btn-ember full" href="https://calendly.com/lilbirdlifecoaching/first-flight-session">Book now — $149 →</a>`;
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
    const sess = document.getElementById('dash-session-info');
    if (sess) {
      sess.textContent = '';
      sess.classList.add('hidden');
      sess.classList.remove('warn');
    }
  }
  const tabProducts = document.getElementById('tab-products');
  const tabProfile = document.getElementById('tab-profile');
  const tabAsk = document.getElementById('tab-ask');
  const btnOpenAsk = document.getElementById('btn-open-ask');
  if (tabProducts) tabProducts.addEventListener('click', () => setTab('products'));
  if (tabProfile) tabProfile.addEventListener('click', () => setTab('profile'));
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
    document.getElementById('view-auth').classList.remove('active');
    document.getElementById('view-dashboard').classList.add('active');
    setTab('products');
    await hydrateDashboard();
  }

  function showAuth() {
    currentUser = null;
    resetDashboardUi();
    showAuthViewNow();
    resetLoginButton();
  }

  async function forceLogout() {
    suppressDashboard = true;
    clearAllSupabaseAuthStorage();
    showAuthViewNow();
    resetDashboardUi();
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

  sb.auth.onAuthStateChange(async (_evt, session) => {
    if (suppressDashboard || loginInFlight) {
      if (!session?.user) suppressDashboard = false;
      return;
    }
    if (session?.user) await showDashboard();
    else showAuth();
  });

  (async function init() {
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

    const { data } = await sb.auth.getSession();
    if (!data.session?.user) {
      showAuth();
      return;
    }

    await showDashboard();
  })();
})();
