(function () {
  const SUPABASE_URL = 'https://mebqqzbuwkogdxvnihrq.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lYnFxemJ1d2tvZ2R4dm5paHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTMzMjAsImV4cCI6MjA5MzQ4OTMyMH0.AzBotw2siyolNEbzd9cp4VT9FjBrGetiZxGOZsOGZVU';
  const WORKER_URL = 'https://worker-solo.cwwq46sn7m.workers.dev';
  const STRIPE_PUBLISHABLE_KEY = 'pk_live_51QSMYQGAu36WZ7DdlsoNqzwPnsf4HUoOj6F1NZAeGnnH1TPjDEdEQudXIGgTLaUq079aQMI1W2MS6UpMItmTjgxy00HbouBx2g';
  const AGREEMENT_VERSION = 'v2.0-agreement-v3-pdf';

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
  let activePromoCode = null;

  const form = document.getElementById('form-enrol');
  const formError = document.getElementById('form-error');
  const btnContinue = document.getElementById('btn-continue');
  const loggedInBanner = document.getElementById('logged-in-banner');
  const accountFields = document.getElementById('account-fields');
  const enrolEmail = document.getElementById('enrol-email');
  const promoInput = document.getElementById('promo-input');
  const promoMessage = document.getElementById('promo-message');
  const checkoutPromoNote = document.getElementById('checkout-promo-note');

  function normalisePromoCode(raw) {
    return String(raw || '').trim().toUpperCase();
  }

  function setPromoMessage(text, kind) {
    if (!promoMessage) return;
    promoMessage.textContent = text || '';
    promoMessage.className = 'promo-message' + (kind ? ' ' + kind : '');
  }

  function applyPromoFromInput() {
    const code = normalisePromoCode(promoInput?.value);
    if (!code) {
      activePromoCode = null;
      setPromoMessage('', '');
      return;
    }
    activePromoCode = code;
    setPromoMessage('“' + code + '” will be checked when payment opens.', 'pending');
  }

  document.getElementById('btn-apply-promo')?.addEventListener('click', applyPromoFromInput);
  promoInput?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      applyPromoFromInput();
    }
  });

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
    if (user.email) enrolEmail.value = user.email;
    enrolEmail.removeAttribute('required');
    enrolEmail.readOnly = true;
    const metaName = user.user_metadata?.full_name || '';
    if (metaName && !document.getElementById('signer-name').value) {
      document.getElementById('signer-name').value = metaName;
    }
  }

  function hideLoggedIn() {
    loggedInBanner.classList.add('hidden');
    enrolEmail.readOnly = false;
    enrolEmail.setAttribute('required', '');
  }

  async function prepareEnrol(signerName, signerEmail) {
    const res = await fetch(WORKER_URL + '/intensive-prepare-enrol', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser?.id || null,
        signer_name: signerName,
        signer_email: signerEmail,
        agreement_version: AGREEMENT_VERSION
      })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Could not save your agreement.');
    }
    return res.json();
  }

  function openCheckoutModal() {
    document.getElementById('checkout-mount').innerHTML = '';
    document.getElementById('checkout-loading').style.display = '';
    document.getElementById('checkout-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
    setStep(2);
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
          signer_name: signerName,
          promo_code: activePromoCode || normalisePromoCode(promoInput?.value) || null
        })
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || 'Could not start checkout (HTTP ' + res.status + ').');
      }

      const payload = await res.json();
      const client_secret = payload.client_secret;
      if (!client_secret) throw new Error('Stripe did not return a checkout session.');

      const codeUsed = payload.promo_code || activePromoCode;
      if (checkoutPromoNote) {
        if (payload.promo_applied && codeUsed) {
          checkoutPromoNote.textContent = 'Promo “' + codeUsed + '” applied.';
          checkoutPromoNote.style.color = 'var(--green)';
        } else if (codeUsed) {
          checkoutPromoNote.textContent =
            '“' + codeUsed + '” could not be pre-applied — use “Add promotion code” below, or go back and check spelling.';
          checkoutPromoNote.style.color = '';
        } else {
          checkoutPromoNote.textContent =
            'Have a promo code? Click “Add promotion code” in the form below.';
          checkoutPromoNote.style.color = '';
        }
      }

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
    const email = (currentUser?.email || enrolEmail.value).trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      formError.textContent = 'Please enter a valid email.';
      return;
    }

    if (signatureTyped.toLowerCase() !== signerName.toLowerCase()) {
      formError.textContent = 'Typed signature must match your full legal name exactly.';
      return;
    }

    btnContinue.disabled = true;
    btnContinue.textContent = 'Saving agreement…';
    setStep(2);

    try {
      if (currentUser && await hasIntensiveEntitlement(currentUser.id)) {
        window.location.href = '/nest/';
        return;
      }

      const prepared = await prepareEnrol(signerName, email);
      const userId = prepared.user_id;
      if (!userId) throw new Error('Could not prepare enrolment.');

      btnContinue.textContent = 'Opening payment…';
      await startCheckout(userId, email, signerName);
    } catch (err) {
      console.error('Enrol error:', err);
      formError.textContent = err.message || 'Something went wrong. Please try again.';
      setStep(2);
    } finally {
      btnContinue.disabled = false;
      btnContinue.textContent = '» Continue to payment';
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
    const params = new URLSearchParams(window.location.search);
    const urlPromo = params.get('code') || params.get('promo');
    if (urlPromo && promoInput) {
      promoInput.value = urlPromo.trim();
      applyPromoFromInput();
    }
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
