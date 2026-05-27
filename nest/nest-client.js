(function () {
  const SUPABASE_URL = 'https://mebqqzbuwkogdxvnihrq.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lYnFxemJ1d2tvZ2R4dm5paHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTMzMjAsImV4cCI6MjA5MzQ4OTMyMH0.AzBotw2siyolNEbzd9cp4VT9FjBrGetiZxGOZsOGZVU';
  const CHAT_WORKER_URL = 'https://lilbird-chat.cwwq46sn7m.workers.dev/';
  const ASSESSMENT_WORKER_URL = 'https://lilbird-assessment.cwwq46sn7m.workers.dev';
  // Optional secure endpoint for sending a Resend "Your Nest is ready" email.
  // Leave empty unless you have a backend endpoint configured.
  const NEST_WELCOME_EMAIL_ENDPOINT = '';

  const { createClient } = supabase;
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
      storageKey: 'lilbird-nest-auth',
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
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) loginError.textContent = error.message || 'Could not log in.';
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

  async function hydrateDashboard() {
    const uid = currentUser.id;

    const [entRes, courseRes, progressRes, linkRes] = await Promise.all([
      sb.from('user_entitlements').select('product,active').eq('user_id', uid).eq('active', true),
      sb.from('course_users').select('*').eq('id', uid).maybeSingle(),
      sb.from('session_progress').select('*').eq('user_id', uid).order('session_number'),
      sb.from('deep_profile_links').select('nest_id').eq('user_id', uid).maybeSingle()
    ]);

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

    document.getElementById('profile-dot').classList.toggle('hidden', !deepProfile);
    renderNextSteps();
    renderProducts();
    renderProfile();
    renderSidebar();
  }

  function renderNextSteps() {
    const steps = [];
    const hasInner = entitlements.has('inner_compass');
    const hasSolo = entitlements.has('solo_course');
    const hasFirstFlight = entitlements.has('first_flight');
    const hasIntensive = entitlements.has('life_change_intensive');

    steps.push({ done: hasInner, text: hasInner ? 'Inner Compass unlocked' : 'Take your Inner Compass assessment' });
    steps.push({ done: hasSolo || hasFirstFlight || hasIntensive, text: 'Your Nest account is active' });
    steps.push({ done: hasSolo || hasIntensive || hasFirstFlight, text: hasSolo ? 'Continue your Solo journey' : 'Unlock your next product in the Nest' });
    steps.push({ done: !!deepProfile, text: !!deepProfile ? 'Profile result loaded in My profile' : 'Review your profile in My profile once ready' });

    const ul = document.getElementById('next-steps-list');
    ul.innerHTML = steps
      .map((s) => `<li class="${s.done ? 'done' : ''}">${s.done ? '✓' : '○'} ${escapeHtml(s.text)}</li>`)
      .join('');
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
        const arch = deepProfile?.archetypePlain || deepProfile?.archetype || 'Inner Compass ready';
        const mbti = deepProfile?.mbti || deepProfile?.likelyCoreMbti || 'MBTI pending';
        const enne = deepProfile?.enneagram || deepProfile?.likelyCoreEnneagram || 'Enneagram pending';
        return `
          <article class="product-card">
            <p class="eyebrow">assessment</p>
            <h3>Inner Compass read</h3>
            <div class="tag-row"><span class="tag">${escapeHtml(arch)}</span><span class="tag">${escapeHtml(mbti)}</span><span class="tag">${escapeHtml(enne)}</span></div>
            <p>Your foundational wiring read is available.</p>
            <div class="btn-row"><a class="btn btn-gold" href="/deep-profile.html${deepNestId ? `?nest=${encodeURIComponent(deepNestId)}` : ''}">View full read →</a></div>
          </article>`;
      }
      return `
        <article class="product-card locked">
          <span class="lock-pill"><i class="ti ti-lock"></i> not yet unlocked</span>
          <p class="eyebrow">assessment</p>
          <h3>Inner Compass read</h3>
          <p>Understand your wiring. The foundation everything else builds on.</p>
          <div class="btn-row"><a class="btn btn-ember" href="/deep-profile.html">Take the Inner Compass →</a></div>
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
              <a class="btn btn-gold" href="/workbooks/first-flight-standalone.html">Open workbook</a>
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
            <div class="btn-row"><a class="btn btn-gold" href="/workbooks/roots-and-wings-workbook.html">Open workbook →</a></div>
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
    if (entitlements.has('inner_compass') && deepProfile) {
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
          <div class="btn-row"><a class="btn btn-gold" href="/deep-profile.html${deepNestId ? `?nest=${encodeURIComponent(deepNestId)}` : ''}">Open Inner Compass result →</a></div>
        </article>`;
    } else {
      pane.innerHTML = `
        <article class="product-card locked">
          <span class="lock-pill"><i class="ti ti-lock"></i> not yet unlocked</span>
          <p class="eyebrow">my profile</p>
          <h3>Inner Compass profile</h3>
          <p>Take your Inner Compass read first. Your profile will appear here once unlocked.</p>
          <div class="btn-row"><a class="btn btn-ember" href="/deep-profile.html">Take the Inner Compass →</a></div>
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
    document.querySelectorAll('.tab-pane').forEach((el) => el.classList.remove('active'));
    document.getElementById(`tab-${name}`).classList.add('active');
    document.getElementById(`pane-${name}`).classList.add('active');
  }
  document.getElementById('tab-products').addEventListener('click', () => setTab('products'));
  document.getElementById('tab-profile').addEventListener('click', () => setTab('profile'));
  document.getElementById('tab-ask').addEventListener('click', () => setTab('ask'));
  document.getElementById('btn-open-ask').addEventListener('click', () => setTab('ask'));

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
  document.getElementById('tab-ask').addEventListener('click', bootChat);
  document.getElementById('btn-open-ask').addEventListener('click', bootChat);
  document.getElementById('chat-send').addEventListener('click', sendChat);
  document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });

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

  async function showDashboard(session) {
    currentUser = session.user;
    document.getElementById('view-auth').classList.remove('active');
    document.getElementById('view-dashboard').classList.add('active');
    await hydrateDashboard();
  }

  function showAuth() {
    currentUser = null;
    document.getElementById('view-dashboard').classList.remove('active');
    document.getElementById('view-auth').classList.add('active');
  }

  sb.auth.onAuthStateChange(async (_evt, session) => {
    if (session?.user) await showDashboard(session);
    else showAuth();
  });

  (async function init() {
    const { data } = await sb.auth.getSession();
    if (data.session?.user) await showDashboard(data.session);
    else showAuth();
  })();
})();
