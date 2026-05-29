(function () {
  const SUPABASE_URL = 'https://mebqqzbuwkogdxvnihrq.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lYnFxemJ1d2tvZ2R4dm5paHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTMzMjAsImV4cCI6MjA5MzQ4OTMyMH0.AzBotw2siyolNEbzd9cp4VT9FjBrGetiZxGOZsOGZVU';
  const WORKER_URL = 'https://worker-solo.cwwq46sn7m.workers.dev';
  const STRIPE_PUBLISHABLE_KEY = 'pk_live_51QSMYQGAu36WZ7DdlsoNqzwPnsf4HUoOj6F1NZAeGnnH1TPjDEdEQudXIGgTLaUq079aQMI1W2MS6UpMItmTjgxy00HbouBx2g';
  const AGREEMENT_VERSION = 'v2.0-agreement-v3-pdf';
  const NEST_REDIRECT = window.location.origin + '/nest/';

  const { createClient } = supabase;
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
      storageKey: 'lilbird-solo-auth',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  });

  let currentUser = null;
  let stripeInstance = null;
  let embeddedCheckout = null;

  const form = document.getElementById('form-enrol');
  const formError = document.getElementById('form-error');
  const btnContinue = document.getElementById('btn-continue');
  const loggedInBanner = document.getElementById('logged-in-banner');
  const accountFields = document.getElementById('account-fields');
  const enrolEmail = document.getElementById('enrol-email');
  const enrolPassword = document.getElementById('enrol-password');

  function setStep(step) {
    document.querySelectorAll('.step-pill').forEach((pill) => {
      const n = Number(pill.dataset.step);
      pill.classList.toggle('done', n < step);
      pill.classList.toggle('active', n === step);
    });
  }

  function getStripe() {
    if (!stripeInstance) {
      if (typeof Stripe !== 'function') throw new Error('Stripe.js failed to load.');
      stripeInstance = Stripe(STRIPE_PUBLISHABLE_KEY);
    }
    return stripeInstance;
  }

  async function hasIntensiveEntitlement(userId) {
    const { data } = await sb.from('user_entitlements')
      .select('product')
      .eq('user_id', userId)
      .eq('product', 'life_change_intensive')
      .eq('active', true)
      .maybeSingle();
    return !!data;
  }

  function showLoggedIn(user) {
    loggedInBanner.classList.remove('hidden');
    document.getElementById('logged-in-email').textContent = user.email;
    accountFields.classList.add('hidden');
    enrolEmail.removeAttribute('required');
    enrolPassword.removeAttribute('required');
    if (user.email) enrolEmail.value = user.email;
    const metaName = user.user_metadata?.full_name || '';
    if (metaName && !document.getElementById('signer-name').value) {
      document.getElementById('signer-name').value = metaName;
    }
  }

  function hideLoggedIn() {
    loggedInBanner.classList.add('hidden');
    accountFields.classList.remove('hidden');
    enrolEmail.setAttribute('required', '');
    enrolPassword.setAttribute('required', '');
  }

  async function ensureUser(name, email, password) {
    if (currentUser) return currentUser;

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: NEST_REDIRECT
      }
    });

    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        const signIn = await sb.auth.signInWithPassword({ email, password });
        if (signIn.error) {
          throw new Error(
            'An account with this email already exists. Log in at your Nest with that password, then return here — or use Forgot password.'
          );
        }
        return signIn.data.session.user;
      }
      throw error;
    }

    if (data.session?.user) return data.session.user;

    if (data.user) {
      const signIn = await sb.auth.signInWithPassword({ email, password });
      if (signIn.data.session?.user) return signIn.data.session.user;
      throw new Error('Account created but login failed. Try logging in at your Nest, then return here.');
    }

    throw new Error('Could not create account. Please try again.');
  }

  async function saveContract(userId, signerName, signerEmail) {
    const res = await fetch(WORKER_URL + '/intensive-save-contract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        signer_name: signerName,
        signer_email: signerEmail,
        agreement_version: AGREEMENT_VERSION
      })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Could not save your agreement signature.');
    }
  }

  function openCheckoutModal() {
    document.getElementById('checkout-mount').innerHTML = '';
    document.getElementById('checkout-loading').style.display = '';
    document.getElementById('checkout-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
    setStep(3);
  }

  function closeCheckoutModal() {
    document.getElementById('checkout-modal').classList.remove('active');
    document.body.style.overflow = '';
    if (embeddedCheckout) {
      try { embeddedCheckout.destroy(); } catch (e) { /* ignore */ }
      embeddedCheckout = null;
    }
    document.getElementById('checkout-mount').innerHTML = '';
  }

  function showCheckoutError(msg) {
    document.getElementById('checkout-loading').style.display = 'none';
    document.getElementById('checkout-mount').innerHTML =
      '<div class="checkout-error"><strong>Could not start checkout</strong><p>' +
      (msg || 'Please try again or email hello@lilbird.life.') +
      '</p></div>';
  }

  async function startCheckout(userId, email, signerName) {
    openCheckoutModal();

    try {
      const stripe = getStripe();
      const res = await fetch(WORKER_URL + '/create-intensive-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          email,
          signer_name: signerName
        })
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || 'Could not start checkout (HTTP ' + res.status + ').');
      }

      const { client_secret } = await res.json();
      if (!client_secret) throw new Error('Stripe did not return a checkout session.');

      if (embeddedCheckout) {
        try { embeddedCheckout.destroy(); } catch (e) { /* ignore */ }
        embeddedCheckout = null;
      }

      embeddedCheckout = await stripe.initEmbeddedCheckout({ clientSecret: client_secret });
      document.getElementById('checkout-loading').style.display = 'none';
      embeddedCheckout.mount('#checkout-mount');
    } catch (err) {
      console.error('Intensive checkout:', err);
      showCheckoutError(err.message);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.textContent = '';

    const signerName = document.getElementById('signer-name').value.trim();
    const signatureTyped = document.getElementById('signature-typed').value.trim();
    const email = enrolEmail.value.trim().toLowerCase();
    const password = enrolPassword.value;

    if (signatureTyped.toLowerCase() !== signerName.toLowerCase()) {
      formError.textContent = 'Typed signature must match your full legal name exactly.';
      return;
    }

    btnContinue.disabled = true;
    btnContinue.textContent = 'Saving agreement…';
    setStep(2);

    try {
      let user = currentUser;
      if (!user) {
        if (password.length < 8) {
          formError.textContent = 'Password must be at least 8 characters.';
          return;
        }
        user = await ensureUser(signerName, email, password);
        currentUser = user;
      }

      if (await hasIntensiveEntitlement(user.id)) {
        window.location.href = '/nest/';
        return;
      }

      await saveContract(user.id, signerName, user.email || email);
      btnContinue.textContent = 'Opening payment…';
      await startCheckout(user.id, user.email || email, signerName);
    } catch (err) {
      console.error('Enrol error:', err);
      formError.textContent = err.message || 'Something went wrong. Please try again.';
      setStep(2);
    } finally {
      btnContinue.disabled = false;
      btnContinue.textContent = 'Continue to secure payment →';
    }
  });

  document.getElementById('checkout-modal-close').addEventListener('click', closeCheckoutModal);
  document.getElementById('checkout-modal').addEventListener('click', (ev) => {
    if (ev.target.id === 'checkout-modal') closeCheckoutModal();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && document.getElementById('checkout-modal').classList.contains('active')) {
      closeCheckoutModal();
    }
  });

  document.getElementById('link-logout').addEventListener('click', async (ev) => {
    ev.preventDefault();
    await sb.auth.signOut();
    currentUser = null;
    hideLoggedIn();
  });

  document.getElementById('signer-name').addEventListener('input', () => setStep(1));
  document.getElementById('agree-checkbox').addEventListener('change', () => setStep(2));

  async function init() {
    setStep(1);
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      currentUser = user;
      if (await hasIntensiveEntitlement(user.id)) {
        window.location.href = '/nest/';
        return;
      }
      showLoggedIn(user);
      setStep(2);
    }
  }

  init();
})();
