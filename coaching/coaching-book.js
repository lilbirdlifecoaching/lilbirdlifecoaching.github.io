(function () {
  const WORKER_URL = 'https://worker-solo.cwwq46sn7m.workers.dev';
  const STRIPE_PUBLISHABLE_KEY = 'pk_live_51QSMYQGAu36WZ7DdlsoNqzwPnsf4HUoOj6F1NZAeGnnH1TPjDEdEQudXIGgTLaUq079aQMI1W2MS6UpMItmTjgxy00HbouBx2g';

  let stripeInstance = null;
  let embeddedCheckout = null;
  let activePromoCode = null;

  const form = document.getElementById('form-book');
  const formError = document.getElementById('form-error');
  const btnContinue = document.getElementById('btn-continue');
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
    setPromoMessage(
      '“' + code + '” will be applied when you open payment (if valid in Stripe).',
      'pending'
    );
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
    setStep(1);
  }

  function showCheckoutError(msg) {
    document.getElementById('checkout-loading').style.display = 'none';
    document.getElementById('checkout-mount').innerHTML =
      '<div class="checkout-error"><strong>Could not start checkout</strong><p>' +
      (msg || 'Please try again or email hello@lilbird.life.') +
      '</p></div>';
  }

  async function startCheckout(email, buyerName) {
    openCheckoutModal();

    try {
      const stripe = getStripe();
      const res = await fetch(WORKER_URL + '/create-coaching-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          buyer_name: buyerName,
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
          checkoutPromoNote.textContent = 'Promo code “' + codeUsed + '” applied to this payment.';
          checkoutPromoNote.style.color = 'var(--green)';
        } else if (codeUsed) {
          checkoutPromoNote.textContent =
            '“' + codeUsed + '” could not be pre-applied — use “Add promotion code” in the Stripe form below, or go back and check the spelling.';
          checkoutPromoNote.style.color = '';
        } else {
          checkoutPromoNote.textContent =
            'Have a promo code? Click “Add promotion code” in the Stripe form below.';
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
      console.error('Coaching checkout:', err);
      showCheckoutError(err.message);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.textContent = '';

    const buyerName = document.getElementById('buyer-name').value.trim();
    const email = document.getElementById('buyer-email').value.trim().toLowerCase();

    if (!buyerName || !email) {
      formError.textContent = 'Name and email are required.';
      return;
    }

    btnContinue.disabled = true;
    btnContinue.textContent = 'Opening payment…';

    try {
      await startCheckout(email, buyerName);
    } catch (err) {
      console.error('Book error:', err);
      formError.textContent = err.message || 'Something went wrong. Please try again.';
      setStep(1);
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

  function init() {
    setStep(1);
    const params = new URLSearchParams(window.location.search);
    const urlPromo = params.get('code') || params.get('promo');
    if (urlPromo && promoInput) {
      promoInput.value = urlPromo.trim();
      applyPromoFromInput();
    }
  }

  init();
})();
