(function () {
  const WORKER_URL = 'https://worker-solo.cwwq46sn7m.workers.dev';
  const STRIPE_PUBLISHABLE_KEY = 'pk_live_51QSMYQGAu36WZ7DdlsoNqzwPnsf4HUoOj6F1NZAeGnnH1TPjDEdEQudXIGgTLaUq079aQMI1W2MS6UpMItmTjgxy00HbouBx2g';
  const CAL_EVENT_URL = 'https://cal.com/luke-haythorpe/coaching-session';
  const CHECKOUT_PATH = '/create-coaching-checkout-session';
  const DEFAULT_PROMO = '';
  const PROMO_KEY = 'lilbird-coaching-promo';

  const params = new URLSearchParams(window.location.search);
  const bookingUid = (params.get('uid') || '').trim();

  // Cal.com redirects inside the embedded calendar; move the pay step to the full window.
  if (bookingUid && window.top !== window.self) {
    window.top.location.href = window.location.href;
    return;
  }

  let stripeInstance = null;
  let embeddedCheckout = null;
  let activePromoCode = null;

  const form = document.getElementById('form-book');
  const formError = document.getElementById('form-error');
  const btnContinue = document.getElementById('btn-continue');
  const promoInput = document.getElementById('promo-input');
  const promoMessage = document.getElementById('promo-message');
  const checkoutPromoNote = document.getElementById('checkout-promo-note');

  const HOLD_ERRORS = {
    pick_time_first: "We couldn't find your held time. Please pick a time again.",
    time_released: 'That time was released because payment took longer than an hour. Please pick a time again.',
    already_confirmed: 'This time is already paid for and confirmed. Check your email for the details.'
  };

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
    setPromoMessage('“' + code + '” will be applied when you open payment (if valid in Stripe).', 'pending');
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

  function openCheckoutModal() {
    document.getElementById('checkout-mount').innerHTML = '';
    document.getElementById('checkout-loading').style.display = '';
    document.getElementById('checkout-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
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

  function showHoldError(code) {
    closeCheckoutModal();
    formError.textContent = HOLD_ERRORS[code] + ' ';
    if (code !== 'already_confirmed') {
      const a = document.createElement('a');
      a.href = window.location.pathname;
      a.textContent = 'Pick a time →';
      formError.append(a);
    }
  }

  function showCheckoutError(msg) {
    document.getElementById('checkout-loading').style.display = 'none';
    const mount = document.getElementById('checkout-mount');
    mount.innerHTML = '<div class="checkout-error"><strong>Could not start checkout</strong><p></p></div>';
    mount.querySelector('p').textContent = msg || 'Please try again or email hello@lilbird.life.';
  }

  async function startCheckout() {
    openCheckoutModal();
    try {
      const stripe = getStripe();
      const res = await fetch(WORKER_URL + CHECKOUT_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_uid: bookingUid,
          promo_code: activePromoCode || normalisePromoCode(promoInput?.value) || null
        })
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        if (HOLD_ERRORS[errBody.error]) {
          showHoldError(errBody.error);
          return;
        }
        throw new Error(errBody.error || 'Could not start checkout (HTTP ' + res.status + ').');
      }

      const payload = await res.json();
      if (!payload.client_secret) throw new Error('Stripe did not return a checkout session.');

      const codeUsed = payload.promo_code || activePromoCode;
      if (checkoutPromoNote) {
        if (payload.promo_applied && codeUsed) {
          checkoutPromoNote.textContent = 'Promo code “' + codeUsed + '” applied to this payment.';
          checkoutPromoNote.style.color = 'var(--green)';
        } else if (codeUsed) {
          checkoutPromoNote.textContent =
            '“' + codeUsed + '” could not be pre-applied — use “Add promotion code” in the Stripe form below, or go back and check the spelling.';
          checkoutPromoNote.style.color = '';
        } else {
          checkoutPromoNote.textContent = 'Have a promo code? Click “Add promotion code” in the Stripe form below.';
          checkoutPromoNote.style.color = '';
        }
      }

      if (embeddedCheckout) {
        try { embeddedCheckout.destroy(); } catch (e) { /* ignore */ }
        embeddedCheckout = null;
      }
      embeddedCheckout = await stripe.initEmbeddedCheckout({ clientSecret: payload.client_secret });
      document.getElementById('checkout-loading').style.display = 'none';
      embeddedCheckout.mount('#checkout-mount');
    } catch (err) {
      console.error('Checkout:', err);
      showCheckoutError(err.message);
    }
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.textContent = '';
    btnContinue.disabled = true;
    btnContinue.textContent = 'Opening payment…';
    try {
      await startCheckout();
    } finally {
      btnContinue.disabled = false;
      btnContinue.textContent = 'Pay to confirm →';
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

  function formatSlot(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    });
  }

  function showPickStep() {
    setStep(1);
    document.getElementById('section-pick').hidden = false;
    document.getElementById('section-details').hidden = true;
    const urlPromo = params.get('code') || params.get('promo');
    if (urlPromo) {
      try { sessionStorage.setItem(PROMO_KEY, urlPromo.trim()); } catch (e) { /* ignore */ }
    }
    const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const calParams = new URLSearchParams({ layout: 'month_view', theme });
    const name = (params.get('name') || '').trim();
    const email = (params.get('email') || '').trim();
    if (name) calParams.set('name', name);
    if (email) calParams.set('email', email);
    const frame = document.getElementById('cal-frame');
    frame.addEventListener('load', () => document.getElementById('cal-loading')?.remove());
    frame.src = CAL_EVENT_URL + '?' + calParams.toString();
  }

  function showPayStep() {
    setStep(2);
    document.getElementById('section-pick').hidden = true;
    document.getElementById('section-details').hidden = false;
    document.getElementById('held-time').textContent = formatSlot(params.get('startTime')) || 'Your chosen time';
    document.getElementById('buyer-name').textContent = (params.get('attendeeName') || '').trim();
    document.getElementById('buyer-email').textContent = (params.get('email') || '').trim();
    if (promoInput) {
      let saved = '';
      try { saved = sessionStorage.getItem(PROMO_KEY) || ''; } catch (e) { /* ignore */ }
      const code = params.get('code') || saved || DEFAULT_PROMO;
      if (code) {
        promoInput.value = code;
        applyPromoFromInput();
      }
    }
  }

  if (bookingUid) showPayStep();
  else showPickStep();
})();
